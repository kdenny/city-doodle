"""Growth simulation engine.

Simulates city growth over time steps by:
1. Infilling existing districts (increasing density)
2. Expanding district boundaries at edges
3. Adding new road connections in expanded areas
4. Spawning new POIs based on growth needs
5. Respecting historic district preservation flags
"""

import logging
import math
import random
import uuid
from typing import Any

from city_worker.growth.types import ChangeEntry, GrowthChangelog, GrowthConfig

logger = logging.getLogger(__name__)

# POI types that support each district type
DISTRICT_POI_NEEDS: dict[str, list[str]] = {
    "residential": ["school", "park", "shopping"],
    "downtown": ["shopping", "civic", "transit"],
    "commercial": ["shopping", "transit"],
    "industrial": ["industrial", "transit"],
    "hospital": ["hospital"],
    "university": ["university"],
    "k12": ["school"],
    "park": ["park"],
    "airport": ["transit"],
}

# Road class for new roads spawned during growth
GROWTH_ROAD_CLASS = "local"


def _get_outer_ring(geometry: dict) -> list[list[float]] | None:
    """Extract the outer ring from a GeoJSON-like polygon geometry."""
    coords = geometry.get("coordinates")
    if not coords or not isinstance(coords, list) or len(coords) == 0:
        return None
    ring = coords[0] if isinstance(coords[0], list) and len(coords[0]) > 0 else coords
    if not ring or len(ring) < 3:
        return None
    return ring


def _point_in_ring(px: float, py: float, ring: list[list[float]]) -> bool:
    """Ray-casting point-in-polygon test for a single ring."""
    n = len(ring)
    inside = False
    j = n - 1
    for i in range(n):
        pi = ring[i]
        pj = ring[j]
        if not (isinstance(pi, list) and len(pi) >= 2 and isinstance(pj, list) and len(pj) >= 2):
            j = i
            continue
        xi, yi = pi[0], pi[1]
        xj, yj = pj[0], pj[1]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


class GrowthSimulator:
    """Runs growth simulation on in-memory data and produces a changelog."""

    def __init__(self, config: GrowthConfig, seed: int = 0) -> None:
        self.config = config
        self.rng = random.Random(seed)

    def simulate(
        self,
        districts: list[dict[str, Any]],
        road_nodes: list[dict[str, Any]],
        road_edges: list[dict[str, Any]],
        pois: list[dict[str, Any]],
        terrain_water_regions: list[dict[str, Any]] | None = None,
    ) -> GrowthChangelog:
        """Run growth simulation and return changelog with mutations.

        All input dicts are DB row representations. The simulator mutates them
        in place and records changes in the changelog.
        """
        changelog = GrowthChangelog(
            world_id=self.config.world_id,
            years_simulated=self.config.years,
        )

        for year in range(self.config.years):
            self._simulate_year(
                districts, road_nodes, road_edges, pois,
                terrain_water_regions, changelog,
            )

        return changelog

    def _simulate_year(
        self,
        districts: list[dict],
        road_nodes: list[dict],
        road_edges: list[dict],
        pois: list[dict],
        water_regions: list[dict] | None,
        changelog: GrowthChangelog,
    ) -> None:
        """Simulate one year of growth."""
        for district in districts:
            if district.get("historic", False):
                changelog.districts_skipped_historic += 1
                continue

            d_type = district["type"]

            # 1. Infill development
            self._infill_district(district, changelog)

            # 2. Expansion at edges (constrained by other districts and water,
            #    biased toward road corridors)
            other_districts = [d for d in districts if d["id"] != district["id"]]
            expanded = self._expand_district(
                district, other_districts, water_regions,
                road_nodes, changelog,
            )

            # 3. New roads in expanded area
            if expanded:
                self._add_growth_roads(
                    district, road_nodes, road_edges, changelog,
                )

            # 4. New POIs if density warrants
            if district.get("density", 0) >= self.config.poi_density_threshold:
                self._add_growth_pois(district, pois, d_type, changelog)

    def _infill_district(
        self, district: dict, changelog: GrowthChangelog,
    ) -> None:
        """Increase density in an existing district."""
        d_type = district["type"]
        rate = self.config.infill_rates.get(d_type, 0.02)
        max_density = self.config.max_density.get(d_type, 10.0)
        old_density = district.get("density", 1.0)

        new_density = min(old_density * (1 + rate), max_density)
        if new_density <= old_density:
            return

        district["density"] = round(new_density, 3)

        # Increase max_height for high-density districts
        if new_density > 5.0 and district.get("max_height", 4) < 20:
            district["max_height"] = min(district.get("max_height", 4) + 1, 30)

        changelog.districts_infilled += 1
        changelog.entries.append(ChangeEntry(
            action="infill",
            entity_type="district",
            entity_id=str(district["id"]),
            details={
                "old_density": old_density,
                "new_density": district["density"],
                "max_height": district.get("max_height"),
            },
        ))

    def _expand_district(
        self,
        district: dict,
        other_districts: list[dict],
        water_regions: list[dict] | None,
        road_nodes: list[dict],
        changelog: GrowthChangelog,
    ) -> bool:
        """Expand district geometry outward. Returns True if expanded.

        Constrains expansion so points don't enter other districts (CITY-310)
        or water regions (CITY-309). Biases expansion toward road corridors
        so growth follows transportation infrastructure (CITY-316).
        """
        geometry = district.get("geometry")
        if not geometry or not isinstance(geometry, dict):
            return False

        coords = geometry.get("coordinates")
        if not coords or not isinstance(coords, list) or len(coords) == 0:
            return False

        # Work with the outer ring of the polygon
        ring = coords[0] if isinstance(coords[0], list) and len(coords[0]) > 0 else coords
        if not ring or len(ring) < 3:
            return False

        # Calculate centroid
        cx = sum(p[0] for p in ring if isinstance(p, list) and len(p) >= 2) / max(len(ring), 1)
        cy = sum(p[1] for p in ring if isinstance(p, list) and len(p) >= 2) / max(len(ring), 1)

        # Pre-compute outer rings of other districts for collision checks
        other_rings = []
        for od in other_districts:
            od_geom = od.get("geometry")
            if od_geom and isinstance(od_geom, dict):
                od_ring = _get_outer_ring(od_geom)
                if od_ring:
                    other_rings.append(od_ring)

        # Pre-compute water region rings
        water_rings: list[list[list[float]]] = []
        if water_regions:
            for wr in water_regions:
                wr_geom = wr.get("geometry")
                if wr_geom and isinstance(wr_geom, dict):
                    wr_ring = _get_outer_ring(wr_geom)
                    if wr_ring:
                        water_rings.append(wr_ring)

        # Corridor-biased expansion: vertices near roads expand faster
        # Road proximity radius — how close a vertex needs to be to a road node
        road_proximity = 1000  # meters
        # Boost factor for vertices near roads (2.5x normal expansion)
        corridor_boost = 2.5
        # Reduction for vertices far from roads (0.4x normal expansion)
        off_corridor_factor = 0.4

        base_expansion = self.config.expansion_rate
        new_ring = []
        points_constrained = 0
        for p in ring:
            if not isinstance(p, list) or len(p) < 2:
                new_ring.append(p)
                continue
            dx = p[0] - cx
            dy = p[1] - cy

            # Check proximity to road nodes for corridor bias
            near_road = False
            for node in road_nodes:
                pos = node.get("position", {})
                nx, ny = pos.get("x", 0), pos.get("y", 0)
                if math.hypot(p[0] - nx, p[1] - ny) < road_proximity:
                    near_road = True
                    break

            # Apply corridor-biased expansion rate
            if near_road:
                expansion = base_expansion * corridor_boost
            else:
                expansion = base_expansion * off_corridor_factor

            new_x = p[0] + dx * expansion
            new_y = p[1] + dy * expansion

            # Check if expanded point falls inside another district
            constrained = False
            for or_ring in other_rings:
                if _point_in_ring(new_x, new_y, or_ring):
                    constrained = True
                    break

            # Check if expanded point falls inside water
            if not constrained:
                for wr_ring in water_rings:
                    if _point_in_ring(new_x, new_y, wr_ring):
                        constrained = True
                        break

            if constrained:
                # Keep original point position (don't expand this vertex)
                new_ring.append([p[0], p[1]])
                points_constrained += 1
            else:
                new_ring.append([new_x, new_y])

        # Only count as expanded if at least one point actually moved
        if points_constrained >= len(ring):
            return False

        # Update geometry
        if isinstance(coords[0], list) and isinstance(coords[0][0], list):
            geometry["coordinates"] = [new_ring] + coords[1:]
        else:
            geometry["coordinates"] = new_ring

        changelog.districts_expanded += 1
        changelog.entries.append(ChangeEntry(
            action="expand",
            entity_type="district",
            entity_id=str(district["id"]),
            details={
                "expansion_rate": base_expansion,
                "points_constrained": points_constrained,
            },
        ))
        return True

    def _add_growth_roads(
        self,
        district: dict,
        road_nodes: list[dict],
        road_edges: list[dict],
        changelog: GrowthChangelog,
    ) -> None:
        """Add new road nodes/edges in the expanded area of a district."""
        geometry = district.get("geometry", {})
        coords = geometry.get("coordinates", [])
        ring = coords[0] if isinstance(coords[0], list) and isinstance(coords[0][0], list) else coords
        if not ring or len(ring) < 3:
            return

        # Calculate centroid and pick a point on the boundary for new road endpoint
        cx = sum(p[0] for p in ring if isinstance(p, list) and len(p) >= 2) / max(len(ring), 1)
        cy = sum(p[1] for p in ring if isinstance(p, list) and len(p) >= 2) / max(len(ring), 1)

        # Pick a random boundary point for a new road endpoint
        idx = self.rng.randint(0, max(len(ring) - 2, 0))
        bp = ring[idx]
        if not isinstance(bp, list) or len(bp) < 2:
            return

        # Find nearest existing road node to connect to
        nearest_node = None
        nearest_dist = float("inf")
        world_id = str(district["world_id"])

        for node in road_nodes:
            pos = node.get("position", {})
            nx, ny = pos.get("x", 0), pos.get("y", 0)
            d = math.hypot(bp[0] - nx, bp[1] - ny)
            if d < nearest_dist:
                nearest_dist = d
                nearest_node = node

        # Create new endpoint node
        new_node_id = str(uuid.uuid4())
        new_node = {
            "id": new_node_id,
            "world_id": world_id,
            "position": {"x": bp[0], "y": bp[1]},
            "node_type": "endpoint",
            "name": None,
        }
        road_nodes.append(new_node)

        changelog.entries.append(ChangeEntry(
            action="new_road",
            entity_type="road_node",
            entity_id=new_node_id,
            details={"position": new_node["position"]},
        ))

        # Connect to nearest existing node if one exists within reasonable distance
        if nearest_node and nearest_dist < 5000:
            new_edge_id = str(uuid.uuid4())
            new_edge = {
                "id": new_edge_id,
                "world_id": world_id,
                "from_node_id": nearest_node["id"],
                "to_node_id": new_node_id,
                "road_class": GROWTH_ROAD_CLASS,
                "geometry": [],
                "length_meters": nearest_dist,
                "speed_limit": 40,
                "name": None,
                "is_one_way": False,
                "lanes": 2,
                "district_id": str(district["id"]),
            }
            road_edges.append(new_edge)

            changelog.entries.append(ChangeEntry(
                action="new_road",
                entity_type="road_edge",
                entity_id=new_edge_id,
                details={
                    "from_node_id": str(nearest_node["id"]),
                    "to_node_id": new_node_id,
                    "road_class": GROWTH_ROAD_CLASS,
                    "length_meters": round(nearest_dist, 1),
                },
            ))
            changelog.roads_added += 1

    def _add_growth_pois(
        self,
        district: dict,
        pois: list[dict],
        district_type: str,
        changelog: GrowthChangelog,
    ) -> None:
        """Add POIs based on district type needs and current coverage."""
        needed_types = DISTRICT_POI_NEEDS.get(district_type, [])
        if not needed_types:
            return

        # Count existing POIs near this district
        geometry = district.get("geometry", {})
        coords = geometry.get("coordinates", [])
        ring = coords[0] if (
            isinstance(coords[0], list)
            and isinstance(coords[0][0], list)
        ) else coords
        if not ring or len(ring) < 3:
            return

        cx = sum(p[0] for p in ring if isinstance(p, list) and len(p) >= 2) / max(len(ring), 1)
        cy = sum(p[1] for p in ring if isinstance(p, list) and len(p) >= 2) / max(len(ring), 1)

        # Check which POI types are already nearby
        existing_types = set()
        for poi in pois:
            px, py = poi.get("position_x", 0), poi.get("position_y", 0)
            if math.hypot(px - cx, py - cy) < 3000:
                existing_types.add(poi.get("type"))

        # Add one missing POI type per year
        missing = [t for t in needed_types if t not in existing_types]
        if not missing:
            return

        poi_type = self.rng.choice(missing)
        # Place near district centroid with some offset
        offset_x = self.rng.uniform(-500, 500)
        offset_y = self.rng.uniform(-500, 500)

        new_poi_id = str(uuid.uuid4())
        new_poi = {
            "id": new_poi_id,
            "world_id": str(district["world_id"]),
            "type": poi_type,
            "name": f"New {poi_type.title()}",
            "position_x": cx + offset_x,
            "position_y": cy + offset_y,
        }
        pois.append(new_poi)

        changelog.pois_added += 1
        changelog.entries.append(ChangeEntry(
            action="new_poi",
            entity_type="poi",
            entity_id=new_poi_id,
            details={
                "type": poi_type,
                "position_x": new_poi["position_x"],
                "position_y": new_poi["position_y"],
                "district_id": str(district["id"]),
            },
        ))
