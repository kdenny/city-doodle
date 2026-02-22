"""Main terrain generator combining all terrain features."""

import logging
import time
from typing import Any

import numpy as np

from city_worker.terrain.bays import BayConfig, apply_bay_erosion, extract_bays
from city_worker.terrain.clip import clip_features_to_tile
from city_worker.terrain.geographic_masks import apply_geographic_mask
from city_worker.terrain.noise import apply_erosion, generate_heightfield
from city_worker.terrain.types import (
    TerrainConfig,
    TerrainFeature,
    TerrainResult,
    TileTerrainData,
)
from city_worker.terrain.barrier_islands import (
    BarrierIslandConfig,
    extract_barrier_islands,
)
from city_worker.terrain.deltas import extract_deltas
from city_worker.terrain.water import (
    calculate_flow_accumulation,
    extract_beaches,
    extract_coastlines,
    extract_lakes,
    extract_rivers,
)

logger = logging.getLogger(__name__)


class TerrainGenerator:
    """Generates terrain for a 3x3 tile neighborhood."""

    def __init__(self, config: TerrainConfig) -> None:
        self.config = config

    def generate_3x3(self, center_tx: int, center_ty: int) -> TerrainResult:
        """Generate terrain for center tile and 8 neighbors.

        Args:
            center_tx, center_ty: Coordinates of the center tile

        Returns:
            TerrainResult containing all 9 tiles with seamless borders
        """
        logger.info("Generating 3x3 terrain centered at (%d, %d)", center_tx, center_ty)

        t_start = time.perf_counter()

        # Generate all 9 tiles
        tiles: dict[tuple[int, int], TileTerrainData] = {}
        center_data: TileTerrainData | None = None

        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                tx = center_tx + dx
                ty = center_ty + dy

                tile_data = self._generate_tile(tx, ty)

                if dx == 0 and dy == 0:
                    center_data = tile_data
                else:
                    tiles[(dx, dy)] = tile_data

        assert center_data is not None

        total_features = sum(len(t.features) for t in [center_data, *tiles.values()])
        total_ms = (time.perf_counter() - t_start) * 1000

        logger.info(
            "[Terrain] 3x3 generation complete in %.1fms (9 tiles, %d features)",
            total_ms, total_features,
        )

        return TerrainResult(center=center_data, neighbors=tiles)

    def _generate_tile(self, tx: int, ty: int) -> TileTerrainData:
        """Generate terrain for a single tile."""
        cfg = self.config

        t0 = time.perf_counter()

        # Generate base heightfield
        heightfield = generate_heightfield(
            seed=cfg.world_seed,
            tx=tx,
            ty=ty,
            tile_size=cfg.tile_size,
            resolution=cfg.resolution,
            octaves=cfg.height_octaves,
            persistence=cfg.height_persistence,
            lacunarity=cfg.height_lacunarity,
            scale=cfg.height_scale,
        )

        t_heightfield = time.perf_counter()

        # Apply geographic mask to shape terrain per world type (CITY-386)
        heightfield = apply_geographic_mask(
            heightfield=heightfield,
            geographic_setting=cfg.geographic_setting,
            tx=tx,
            ty=ty,
            tile_size=cfg.tile_size,
            resolution=cfg.resolution,
            seed=cfg.world_seed,
        )

        t_mask = time.perf_counter()

        # Apply erosion for more realistic features
        # Derive tile-specific seed from world seed and tile coordinates
        # Use abs() to ensure non-negative seed for numpy's RNG
        erosion_seed = abs(cfg.world_seed ^ (tx * 7919 + ty * 7927))
        heightfield = apply_erosion(heightfield, seed=erosion_seed, iterations=30)

        t_erosion = time.perf_counter()

        # Calculate flow accumulation for river and bay detection
        flow_accumulation = calculate_flow_accumulation(heightfield)

        t_flow = time.perf_counter()

        # Extract water features
        features: list[TerrainFeature] = []

        # Coastlines (land polygons) with fractal detail (CITY-322)
        coastline_seed = abs(cfg.world_seed ^ (tx * 6271 + ty * 6277))
        coastlines = extract_coastlines(
            heightfield=heightfield,
            water_level=cfg.water_level,
            tile_x=tx,
            tile_y=ty,
            tile_size=cfg.tile_size,
            smoothing_iterations=cfg.coastline_smoothing,
            fractal_seed=coastline_seed,
        )
        features.extend(coastlines)

        t_coastlines = time.perf_counter()

        # Bays (concave coastline formations)
        bays: list[TerrainFeature] = []
        if cfg.bay_enabled:
            bay_config = BayConfig(
                min_concavity_angle=cfg.bay_min_concavity_angle,
                min_area=cfg.bay_min_area,
                max_depth_ratio=cfg.bay_max_depth_ratio,
                cove_max_area=cfg.bay_cove_max_area,
                harbor_min_area=cfg.bay_harbor_min_area,
                river_mouth_factor=cfg.bay_river_mouth_factor,
            )
            bays = extract_bays(
                heightfield=heightfield,
                water_level=cfg.water_level,
                tile_x=tx,
                tile_y=ty,
                tile_size=cfg.tile_size,
                seed=cfg.world_seed + tx * 1000 + ty,  # Tile-specific seed
                flow_accumulation=flow_accumulation,
                config=bay_config,
            )
            features.extend(bays)

            # Apply bay erosion to heightfield so downstream features
            # (beaches, rivers, lakes) see the carved-out bay depths
            if bays:
                heightfield = apply_bay_erosion(
                    heightfield=heightfield,
                    bay_features=bays,
                    water_level=cfg.water_level,
                    tile_x=tx,
                    tile_y=ty,
                    tile_size=cfg.tile_size,
                    erosion_strength=cfg.bay_erosion_strength,
                )

        # Collect bay polygons for beach exclusion (CITY-548)
        bay_polygons: list = []
        if cfg.bay_enabled and bays:
            for f in bays:
                if f.type == "bay":
                    from shapely.geometry import shape as _shape
                    bay_polygons.append(_shape(f.geometry))

        t_bays = time.perf_counter()

        # Barrier islands (moved before beaches so lagoon polygons can
        # be used to exclude lagoon-side beaches — CITY-525)
        lagoon_polygons: list = []
        if cfg.barrier_islands_enabled:
            barrier_island_config = BarrierIslandConfig(
                island_offset_min=cfg.barrier_island_offset_min,
                island_offset_max=cfg.barrier_island_offset_max,
                island_width_min=cfg.barrier_island_width_min,
                island_width_max=cfg.barrier_island_width_max,
                island_length_min=cfg.barrier_island_length_min,
                inlet_spacing_min=cfg.barrier_inlet_spacing_min,
                inlet_spacing_max=cfg.barrier_inlet_spacing_max,
            )
            barrier_islands = extract_barrier_islands(
                heightfield=heightfield,
                water_level=cfg.water_level,
                tile_x=tx,
                tile_y=ty,
                tile_size=cfg.tile_size,
                seed=cfg.world_seed,
                config=barrier_island_config,
            )
            features.extend(barrier_islands)
            # Collect lagoon polygons for beach filtering
            for f in barrier_islands:
                if f.type == "lagoon":
                    from shapely.geometry import shape
                    lagoon_polygons.append(shape(f.geometry))

        t_barriers = time.perf_counter()

        # CITY-576: Collect coastline polygons for river endpoint snapping
        coastline_polys: list = []
        for f in coastlines:
            if f.type == "coastline":
                from shapely.geometry import shape as _shape_coast
                coastline_polys.append(_shape_coast(f.geometry))

        # Rivers (moved before beaches so river geometries can be used
        # to filter out river-adjacent beaches — CITY-546)
        rivers = extract_rivers(
            heightfield=heightfield,
            water_level=cfg.water_level,
            tile_x=tx,
            tile_y=ty,
            tile_size=cfg.tile_size,
            flow_threshold=cfg.resolution * 0.8,  # Scale with resolution
            min_length=cfg.min_river_length,
            flow_accumulation=flow_accumulation,
            coastline_polys=coastline_polys if coastline_polys else None,
        )
        features.extend(rivers)

        # Collect river geometries for beach filtering (CITY-546)
        river_lines: list = []
        for f in rivers:
            from shapely.geometry import shape as _shape
            river_lines.append(_shape(f.geometry))

        t_rivers = time.perf_counter()

        # River deltas and estuaries (CITY-179)
        delta_seed = abs(cfg.world_seed ^ (tx * 8311 + ty * 8317))
        deltas = extract_deltas(
            rivers=rivers,
            heightfield=heightfield,
            water_level=cfg.water_level,
            flow_accumulation=flow_accumulation,
            tile_x=tx,
            tile_y=ty,
            tile_size=cfg.tile_size,
            seed=delta_seed,
            min_flow=cfg.resolution * 0.4,  # Lower threshold than rivers
        )
        features.extend(deltas)

        t_deltas = time.perf_counter()

        # Lakes (moved before beaches so lake polygons can be used
        # to cap lake beach coverage — CITY-547)
        lakes = extract_lakes(
            heightfield=heightfield,
            water_level=cfg.water_level,
            tile_x=tx,
            tile_y=ty,
            tile_size=cfg.tile_size,
        )
        features.extend(lakes)

        # Collect lake polygons for beach filtering (CITY-547)
        lake_polygons: list = []
        for f in lakes:
            from shapely.geometry import shape as _shape
            lake_polygons.append(_shape(f.geometry))

        t_lakes = time.perf_counter()

        # Beaches (transition zones between water and land)
        if cfg.beach_enabled:
            beach_seed = abs(cfg.world_seed ^ (tx * 5413 + ty * 5417))
            beaches = extract_beaches(
                heightfield=heightfield,
                water_level=cfg.water_level,
                beach_height_band=cfg.beach_height_band,
                tile_x=tx,
                tile_y=ty,
                tile_size=cfg.tile_size,
                min_length=cfg.beach_min_length,
                max_slope=cfg.beach_slope_max,
                width_multiplier=cfg.beach_width_multiplier,
                max_segment_cells=cfg.beach_max_segment_cells,
                gap_cells=cfg.beach_gap_cells,
                seed=beach_seed,
                lagoon_polygons=lagoon_polygons,
                bay_polygons=bay_polygons,
                river_lines=river_lines,
                lake_polygons=lake_polygons,
            )
            features.extend(beaches)

        t_beaches = time.perf_counter()

        # Generate contour lines
        contours = self._generate_contours(
            heightfield=heightfield,
            tx=tx,
            ty=ty,
            levels=[0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        )
        features.extend(contours)

        t_contours = time.perf_counter()

        # Clip all features to tile boundaries (CITY-530)
        features = clip_features_to_tile(features, tx, ty, cfg.tile_size)

        t_clip = time.perf_counter()

        # Log per-phase timing summary (CITY-591)
        # Note: execution order is barriers -> rivers -> lakes -> beaches,
        # but log labels match the ticket spec order.
        timing_values = (
            (t_heightfield - t0) * 1000,
            (t_mask - t_heightfield) * 1000,
            (t_erosion - t_mask) * 1000,
            (t_flow - t_erosion) * 1000,
            (t_coastlines - t_flow) * 1000,
            (t_bays - t_coastlines) * 1000,
            (t_barriers - t_bays) * 1000,
            (t_beaches - t_lakes) * 1000,
            (t_rivers - t_barriers) * 1000,
            (t_deltas - t_rivers) * 1000,
            (t_lakes - t_deltas) * 1000,
            (t_contours - t_beaches) * 1000,
            (t_clip - t_contours) * 1000,
        )
        total_ms = (t_clip - t0) * 1000
        logger.info(
            "[Terrain] Tile (%d, %d) phase timings: heightfield=%.1fms mask=%.1fms erosion=%.1fms "
            "flow=%.1fms coastlines=%.1fms bays=%.1fms barriers=%.1fms beaches=%.1fms "
            "rivers=%.1fms deltas=%.1fms lakes=%.1fms contours=%.1fms clip=%.1fms total=%.1fms features=%d",
            tx, ty, *timing_values, total_ms, len(features),
        )

        return TileTerrainData(
            tx=tx,
            ty=ty,
            heightfield=heightfield.tolist(),
            features=features,
        )

    def _generate_contours(
        self,
        heightfield: np.ndarray,
        tx: int,
        ty: int,
        levels: list[float],
    ) -> list[TerrainFeature]:
        """Generate contour lines at specified height levels.

        Uses a simple marching squares approach.
        """
        cfg = self.config
        h, w = heightfield.shape
        cell_size = cfg.tile_size / w
        features = []

        # CITY-514: Cap segments per level and early-exit to avoid iterating
        # the full grid when only the first N segments are kept.
        max_segments_per_level = 100

        for level in levels:
            # Find cells that cross this contour level
            contour_segments: list[list[tuple[float, float]]] = []

            for i in range(h - 1):
                if len(contour_segments) >= max_segments_per_level:
                    break
                for j in range(w - 1):
                    # Get corner values
                    v00 = heightfield[i, j]
                    v10 = heightfield[i + 1, j]
                    v01 = heightfield[i, j + 1]
                    v11 = heightfield[i + 1, j + 1]

                    # Determine which corners are above the level
                    case = 0
                    if v00 >= level:
                        case |= 1
                    if v10 >= level:
                        case |= 2
                    if v01 >= level:
                        case |= 4
                    if v11 >= level:
                        case |= 8

                    # Skip if all above or all below
                    if case == 0 or case == 15:
                        continue

                    # Calculate edge intersections
                    x0 = tx * cfg.tile_size + j * cell_size
                    y0 = ty * cfg.tile_size + i * cell_size

                    segments = self._marching_squares_segments(
                        case, v00, v10, v01, v11, level, x0, y0, cell_size
                    )
                    contour_segments.extend(segments)
                    if len(contour_segments) >= max_segments_per_level:
                        break

            # Simplify segments (just use raw segments for now)
            if contour_segments:
                # Group nearby segments into lines (simple approach)
                for seg in contour_segments[:max_segments_per_level]:
                    features.append(
                        TerrainFeature(
                            type="contour",
                            geometry={
                                "type": "LineString",
                                "coordinates": seg,
                            },
                            properties={"elevation": level},
                        )
                    )

        return features

    def _marching_squares_segments(
        self,
        case: int,
        v00: float,
        v10: float,
        v01: float,
        v11: float,
        level: float,
        x0: float,
        y0: float,
        cell_size: float,
    ) -> list[list[tuple[float, float]]]:
        """Generate line segments for a marching squares cell."""

        def lerp_edge(v1: float, v2: float) -> float:
            """Linear interpolation to find crossing point."""
            if abs(v2 - v1) < 1e-10:
                return 0.5
            return (level - v1) / (v2 - v1)

        # Edge midpoints
        top = (x0 + lerp_edge(v00, v01) * cell_size, y0)
        bottom = (x0 + lerp_edge(v10, v11) * cell_size, y0 + cell_size)
        left = (x0, y0 + lerp_edge(v00, v10) * cell_size)
        right = (x0 + cell_size, y0 + lerp_edge(v01, v11) * cell_size)

        # Marching squares lookup table (simplified)
        segments_map: dict[int, list[list[tuple[float, float]]]] = {
            1: [[left, top]],
            2: [[top, right]],
            3: [[left, right]],
            4: [[right, bottom]],
            5: [[left, top], [right, bottom]],
            6: [[top, bottom]],
            7: [[left, bottom]],
            8: [[bottom, left]],
            9: [[top, bottom]],
            10: [[top, right], [bottom, left]],
            11: [[right, bottom]],
            12: [[top, right]],
            13: [[top, right]],
            14: [[left, top]],
        }

        return segments_map.get(case, [])


def generate_terrain_3x3(
    world_seed: int,
    center_tx: int,
    center_ty: int,
    config_overrides: dict[str, Any] | None = None,
) -> TerrainResult:
    """Convenience function to generate 3x3 terrain.

    Args:
        world_seed: Seed for deterministic generation
        center_tx, center_ty: Center tile coordinates
        config_overrides: Optional config parameter overrides

    Returns:
        TerrainResult with 9 tiles
    """
    config_kwargs: dict[str, Any] = {"world_seed": world_seed}
    if config_overrides:
        config_kwargs.update(config_overrides)

    config = TerrainConfig(**config_kwargs)
    generator = TerrainGenerator(config)
    return generator.generate_3x3(center_tx, center_ty)
