"""Terrain generation module for procedural map creation."""

from city_worker.terrain.bays import BayConfig, extract_bays
from city_worker.terrain.generator import TerrainGenerator, generate_terrain_3x3
from city_worker.terrain.types import TerrainConfig, TerrainResult, TileCoord

__all__ = [
    "BayConfig",
    "TerrainGenerator",
    "extract_bays",
    "generate_terrain_3x3",
    "TerrainConfig",
    "TerrainResult",
    "TileCoord",
]
