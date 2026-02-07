"""Terrain generation module for procedural map creation."""

from city_worker.terrain.bays import BayConfig, extract_bays
from city_worker.terrain.generator import TerrainGenerator, generate_terrain_3x3
from city_worker.terrain.geographic_masks import (
    MaskContext,
    apply_geographic_mask,
    get_mask,
    register_mask,
)
from city_worker.terrain.geographic_presets import apply_seed_variation, get_preset_overrides
from city_worker.terrain.types import TerrainConfig, TerrainResult, TileCoord

__all__ = [
    "BayConfig",
    "MaskContext",
    "TerrainGenerator",
    "apply_geographic_mask",
    "extract_bays",
    "generate_terrain_3x3",
    "apply_seed_variation",
    "get_mask",
    "get_preset_overrides",
    "register_mask",
    "TerrainConfig",
    "TerrainResult",
    "TileCoord",
]
