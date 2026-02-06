"""Tests for the growth simulation module."""

from uuid import uuid4

import pytest
from city_worker.growth import GrowthChangelog, GrowthConfig
from city_worker.growth.simulator import GrowthSimulator
from city_worker.growth.types import ChangeEntry


def _make_district(
    district_type: str = "residential",
    density: float = 3.0,
    max_height: int = 8,
    historic: bool = False,
) -> dict:
    """Helper to create a test district dict."""
    return {
        "id": str(uuid4()),
        "world_id": str(uuid4()),
        "type": district_type,
        "name": f"Test {district_type}",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [[0, 0], [1000, 0], [1000, 1000], [0, 1000], [0, 0]],
            ],
        },
        "density": density,
        "max_height": max_height,
        "transit_access": False,
        "historic": historic,
    }


def _make_road_node(x: float = 500, y: float = 500) -> dict:
    """Helper to create a test road node dict."""
    return {
        "id": str(uuid4()),
        "world_id": str(uuid4()),
        "position": {"x": x, "y": y},
        "node_type": "intersection",
        "name": None,
    }


class TestGrowthConfig:
    def test_default_config(self):
        config = GrowthConfig(world_id=uuid4())
        assert config.years == 1
        assert config.expansion_rate == 0.02
        assert "residential" in config.infill_rates

    def test_custom_years(self):
        config = GrowthConfig(world_id=uuid4(), years=5)
        assert config.years == 5


class TestGrowthChangelog:
    def test_to_dict(self):
        wid = uuid4()
        changelog = GrowthChangelog(world_id=wid, years_simulated=5)
        changelog.districts_infilled = 3
        changelog.entries.append(ChangeEntry(
            action="infill",
            entity_type="district",
            entity_id="abc",
            details={"old_density": 3.0, "new_density": 3.15},
        ))

        d = changelog.to_dict()
        assert d["world_id"] == str(wid)
        assert d["years_simulated"] == 5
        assert d["summary"]["districts_infilled"] == 3
        assert len(d["entries"]) == 1
        assert d["entries"][0]["action"] == "infill"


class TestGrowthSimulator:
    def test_empty_world(self):
        """Simulation on empty world produces empty changelog."""
        config = GrowthConfig(world_id=uuid4(), years=1)
        sim = GrowthSimulator(config, seed=42)
        changelog = sim.simulate([], [], [], [])
        assert changelog.districts_infilled == 0
        assert changelog.districts_expanded == 0
        assert changelog.roads_added == 0
        assert changelog.pois_added == 0

    def test_infill_increases_density(self):
        """District density increases after simulation."""
        district = _make_district("residential", density=3.0)
        config = GrowthConfig(world_id=uuid4(), years=1)
        sim = GrowthSimulator(config, seed=42)

        changelog = sim.simulate([district], [], [], [])

        assert district["density"] > 3.0
        assert changelog.districts_infilled == 1

    def test_infill_respects_max_density(self):
        """Density does not exceed the type maximum."""
        district = _make_district("residential", density=7.99)
        config = GrowthConfig(world_id=uuid4(), years=10)
        sim = GrowthSimulator(config, seed=42)

        sim.simulate([district], [], [], [])

        assert district["density"] <= config.max_density["residential"]

    def test_historic_district_unchanged(self):
        """Historic districts are not modified."""
        district = _make_district("residential", density=3.0, historic=True)
        original_density = district["density"]

        config = GrowthConfig(world_id=uuid4(), years=5)
        sim = GrowthSimulator(config, seed=42)
        changelog = sim.simulate([district], [], [], [])

        assert district["density"] == original_density
        assert changelog.districts_skipped_historic == 5  # once per year

    def test_expansion_grows_geometry(self):
        """District geometry expands outward."""
        district = _make_district("downtown", density=5.0)
        original_coords = [
            list(p) for p in district["geometry"]["coordinates"][0]
        ]

        config = GrowthConfig(world_id=uuid4(), years=1)
        sim = GrowthSimulator(config, seed=42)
        changelog = sim.simulate([district], [], [], [])

        new_coords = district["geometry"]["coordinates"][0]
        assert changelog.districts_expanded == 1

        # At least one coordinate should have moved outward from centroid
        cx = sum(p[0] for p in original_coords) / len(original_coords)
        cy = sum(p[1] for p in original_coords) / len(original_coords)

        for orig, new in zip(original_coords[:-1], new_coords[:-1]):
            orig_dist = ((orig[0] - cx) ** 2 + (orig[1] - cy) ** 2) ** 0.5
            new_dist = ((new[0] - cx) ** 2 + (new[1] - cy) ** 2) ** 0.5
            assert new_dist >= orig_dist

    def test_new_roads_added_on_expansion(self):
        """Road nodes and edges are added when a district expands."""
        district = _make_district("commercial", density=4.0)
        existing_node = _make_road_node(500, 500)
        existing_node["world_id"] = district["world_id"]

        config = GrowthConfig(world_id=uuid4(), years=1)
        sim = GrowthSimulator(config, seed=42)

        road_nodes = [existing_node]
        road_edges = []
        changelog = sim.simulate([district], road_nodes, road_edges, [])

        # Should have added at least one new node
        assert len(road_nodes) > 1
        assert changelog.roads_added >= 1

    def test_pois_added_at_high_density(self):
        """POIs are spawned when density exceeds threshold."""
        district = _make_district("residential", density=5.0)

        config = GrowthConfig(world_id=uuid4(), years=1)
        sim = GrowthSimulator(config, seed=42)

        pois = []
        changelog = sim.simulate([district], [], [], pois)

        assert len(pois) > 0
        assert changelog.pois_added > 0
        # Residential districts need school, park, or shopping
        poi_types = {p["type"] for p in pois}
        assert poi_types.issubset({"school", "park", "shopping"})

    def test_pois_not_duplicated(self):
        """POIs are not added if the type already exists nearby."""
        district = _make_district("residential", density=5.0)
        existing_poi = {
            "id": str(uuid4()),
            "world_id": district["world_id"],
            "type": "school",
            "name": "Existing School",
            "position_x": 500,
            "position_y": 500,
        }

        config = GrowthConfig(world_id=uuid4(), years=1)
        sim = GrowthSimulator(config, seed=42)

        pois = [existing_poi]
        sim.simulate([district], [], [], pois)

        # Should not add another school
        school_count = sum(1 for p in pois if p["type"] == "school")
        assert school_count == 1

    def test_multi_year_compounds(self):
        """Multiple years of growth compound density increases."""
        district = _make_district("downtown", density=5.0)

        config = GrowthConfig(world_id=uuid4(), years=5)
        sim = GrowthSimulator(config, seed=42)
        changelog = sim.simulate([district], [], [], [])

        assert district["density"] > 5.0
        assert changelog.districts_infilled == 5
        assert changelog.years_simulated == 5

    def test_deterministic_with_same_seed(self):
        """Same seed produces identical results."""
        def run_sim(seed: int) -> dict:
            district = _make_district("residential", density=3.0)
            config = GrowthConfig(world_id=uuid4(), years=3)
            sim = GrowthSimulator(config, seed=seed)
            changelog = sim.simulate([district], [], [], [])
            return {
                "density": district["density"],
                "infilled": changelog.districts_infilled,
                "expanded": changelog.districts_expanded,
            }

        r1 = run_sim(42)
        r2 = run_sim(42)
        assert r1 == r2

    def test_different_seeds_vary(self):
        """Different seeds can produce different POI placement."""
        results = []
        for seed in [1, 2, 3]:
            district = _make_district("residential", density=5.0)
            config = GrowthConfig(world_id=uuid4(), years=1)
            sim = GrowthSimulator(config, seed=seed)
            pois: list[dict] = []
            sim.simulate([district], [], [], pois)
            if pois:
                results.append(pois[0]["type"])

        # With different seeds, we may get different POI types
        assert len(results) > 0
