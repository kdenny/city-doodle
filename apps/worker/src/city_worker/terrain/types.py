"""Type definitions for terrain generation."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class TileCoord:
    """Tile coordinates in the world grid."""

    tx: int
    ty: int

    def __hash__(self) -> int:
        return hash((self.tx, self.ty))


@dataclass
class TerrainConfig:
    """Configuration for terrain generation.

    All parameters are deterministic given the world seed.
    """

    # World seed for deterministic generation
    world_seed: int

    # Tile size in world units (50 miles = 80467.2 meters)
    tile_size: float = 80467.2

    # Resolution: number of height samples per tile edge
    resolution: int = 128

    # Noise parameters for base heightfield
    height_octaves: int = 6
    height_persistence: float = 0.5
    height_lacunarity: float = 2.0
    height_scale: float = 0.001  # Larger = more zoomed out features

    # Water level threshold (0-1, normalized height below which is water)
    water_level: float = 0.35

    # River parameters
    river_threshold: float = 0.7  # Flow accumulation threshold for rivers
    min_river_length: int = 10  # Minimum segments for a river

    # Lake parameters
    lake_depth_threshold: float = 0.1  # Depression depth to form lake

    # Coastline smoothing iterations
    coastline_smoothing: int = 3

    # Beach parameters
    beach_enabled: bool = True  # Whether to generate beaches
    beach_height_band: float = 0.08  # Height band above water level for beaches
    beach_min_length: int = 5  # Minimum beach segment length in cells
    beach_slope_max: float = 0.15  # Maximum slope for beach formation (gradual slopes only)
    beach_width_multiplier: float = 1.0  # Multiplier for beach width (1.0 = normal)


@dataclass
class TerrainFeature:
    """A single terrain feature in GeoJSON-like format."""

    type: str  # "coastline", "river", "lake", "contour", "beach"
    geometry: dict[str, Any]  # GeoJSON geometry
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass
class TileTerrainData:
    """Terrain data for a single tile."""

    tx: int
    ty: int
    heightfield: list[list[float]]  # 2D array of normalized heights (0-1)
    features: list[TerrainFeature]  # Vector features (coastlines, rivers, etc.)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON storage."""
        return {
            "tx": self.tx,
            "ty": self.ty,
            "heightfield": self.heightfield,
        }

    def features_to_geojson(self) -> dict[str, Any]:
        """Convert features to GeoJSON FeatureCollection."""
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": f.geometry,
                    "properties": {"feature_type": f.type, **f.properties},
                }
                for f in self.features
            ],
        }


@dataclass
class TerrainResult:
    """Result of 3x3 terrain generation."""

    center: TileTerrainData
    neighbors: dict[tuple[int, int], TileTerrainData]  # (dx, dy) -> tile data

    def all_tiles(self) -> list[TileTerrainData]:
        """Return all 9 tiles in the result."""
        return [self.center, *self.neighbors.values()]
