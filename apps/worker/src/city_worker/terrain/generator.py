"""Main terrain generator combining all terrain features."""

import logging
from typing import Any

import numpy as np

from city_worker.terrain.noise import apply_erosion, generate_heightfield
from city_worker.terrain.types import (
    TerrainConfig,
    TerrainFeature,
    TerrainResult,
    TileTerrainData,
)
from city_worker.terrain.water import (
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

        logger.info(
            "Generated 9 tiles with %d total features",
            sum(len(t.features) for t in [center_data, *tiles.values()]),
        )

        return TerrainResult(center=center_data, neighbors=tiles)

    def _generate_tile(self, tx: int, ty: int) -> TileTerrainData:
        """Generate terrain for a single tile."""
        cfg = self.config

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

        # Apply erosion for more realistic features
        heightfield = apply_erosion(heightfield, iterations=30)

        # Extract water features
        features: list[TerrainFeature] = []

        # Coastlines (land polygons)
        coastlines = extract_coastlines(
            heightfield=heightfield,
            water_level=cfg.water_level,
            tile_x=tx,
            tile_y=ty,
            tile_size=cfg.tile_size,
            smoothing_iterations=cfg.coastline_smoothing,
        )
        features.extend(coastlines)

        # Beaches (transition zones between water and land)
        if cfg.beach_enabled:
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
            )
            features.extend(beaches)

        # Rivers
        rivers = extract_rivers(
            heightfield=heightfield,
            water_level=cfg.water_level,
            tile_x=tx,
            tile_y=ty,
            tile_size=cfg.tile_size,
            flow_threshold=cfg.resolution * 0.8,  # Scale with resolution
            min_length=cfg.min_river_length,
        )
        features.extend(rivers)

        # Lakes
        lakes = extract_lakes(
            heightfield=heightfield,
            water_level=cfg.water_level,
            tile_x=tx,
            tile_y=ty,
            tile_size=cfg.tile_size,
            min_area_cells=20,
        )
        features.extend(lakes)

        # Generate contour lines
        contours = self._generate_contours(
            heightfield=heightfield,
            tx=tx,
            ty=ty,
            levels=[0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        )
        features.extend(contours)

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

        for level in levels:
            # Find cells that cross this contour level
            contour_segments = []

            for i in range(h - 1):
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

            # Simplify segments (just use raw segments for now)
            if contour_segments:
                # Group nearby segments into lines (simple approach)
                for seg in contour_segments[:100]:  # Limit to avoid too many features
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
