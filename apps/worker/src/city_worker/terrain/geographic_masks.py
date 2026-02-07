"""Geographic masks for terrain generation (CITY-386).

Each geographic setting can define a mask function that modifies the
heightfield after noise generation but before erosion and feature
extraction.  This allows different world types to have fundamentally
different landform shapes rather than just parameter tweaks.

Mask functions receive the raw heightfield (normalized to [0, 1]) and
a MaskContext with tile position and generation parameters.  They return
a modified heightfield, also in [0, 1].

Individual mask implementations are added by follow-up tickets:
  CITY-387  island      – radial falloff
  CITY-388  inland      – minimal water
  CITY-390  peninsula   – directional falloff
  CITY-391  river_valley – deliberate channel
  CITY-392  bay_harbor  – deliberate indentation
  CITY-393  delta       – fan-shaped river mouth
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable

import numpy as np
from numpy.typing import NDArray


# ── Helpers ──────────────────────────────────────────────────────


def _seeded_hash(seed: int, index: int) -> float:
    """Deterministic float in [0, 1) from *seed* + *index*."""
    h = ((seed * 2654435761) ^ (index * 340573321)) & 0xFFFFFFFF
    h = ((h >> 16) ^ h) * 0x45D9F3B & 0xFFFFFFFF
    h = ((h >> 16) ^ h) & 0xFFFFFFFF
    return h / 0xFFFFFFFF


def _smoothstep(t: NDArray[np.float64]) -> NDArray[np.float64]:
    """Hermite smoothstep: 3t^2 - 2t^3, clamped to [0, 1]."""
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


@dataclass(frozen=True)
class MaskContext:
    """Context passed to geographic mask functions.

    Attributes:
        tx: Tile x coordinate (0 = world center column).
        ty: Tile y coordinate (0 = world center row).
        tile_size: Tile size in world units.
        resolution: Number of height samples per tile edge.
        seed: World seed for deterministic randomness.
    """

    tx: int
    ty: int
    tile_size: float
    resolution: int
    seed: int


# Type alias for mask functions.
MaskFn = Callable[[NDArray[np.float64], MaskContext], NDArray[np.float64]]


# ── Built-in masks ───────────────────────────────────────────────


def identity_mask(
    heightfield: NDArray[np.float64], ctx: MaskContext
) -> NDArray[np.float64]:
    """No-op mask — returns the heightfield unchanged.

    Used as the default for geographic settings that don't need
    deliberate shaping (e.g. "coastal") or as a placeholder until
    a dedicated mask is implemented.
    """
    return heightfield


def bay_harbor_mask(
    heightfield: NDArray[np.float64], ctx: MaskContext
) -> NDArray[np.float64]:
    """Concave bay indentation mask for bay/harbor worlds (CITY-392).

    Creates a protected natural harbor by:
      1. Applying a directional gradient so one side is ocean, the
         other is land (the coastline).
      2. Carving a U-shaped bay depression into the land side so
         water wraps around three sides of the city center.

    The ocean direction is seed-deterministic.
    """
    res = ctx.resolution
    ts = ctx.tile_size
    cx, cy = ts * 0.5, ts * 0.5

    # Seed-based ocean direction
    ocean_dir = _seeded_hash(ctx.seed, 30) * 2.0 * math.pi
    cos_d, sin_d = math.cos(ocean_dir), math.sin(ocean_dir)

    # Build world-coordinate grids
    step = ts / res
    xs = ctx.tx * ts + np.arange(res, dtype=np.float64) * step
    ys = ctx.ty * ts + np.arange(res, dtype=np.float64) * step
    xx, yy = np.meshgrid(xs, ys)
    dx, dy = xx - cx, yy - cy

    # Rotated coordinates: u = toward ocean, v = along coast
    u = dx * cos_d + dy * sin_d
    v = -dx * sin_d + dy * cos_d

    # ── Step 1: Directional gradient ──
    # Bias heights so the ocean side is lower and land side is higher.
    # This creates a clear coastline running roughly through the center.
    grad_scale = ts * 1.5
    gradient = np.clip(0.5 - u / grad_scale * 0.4, 0.3, 1.0)
    result = heightfield * gradient

    # ── Step 2: Bay carve ──
    # Semi-elliptical depression opening toward the ocean.
    bay_depth = ts * 0.40   # How far the bay extends into the land
    bay_half_w = ts * 0.30  # Half-width of the bay opening
    bay_max_dep = 0.30      # Maximum height depression inside the bay

    # Width narrows linearly from opening (u ≈ 0) to back (u = -bay_depth)
    t_bay = np.clip((u + bay_depth) / bay_depth, 0.0, 1.0)
    width_at_u = bay_half_w * t_bay

    # Inside the bay region?
    in_bay_u = (u > -bay_depth) & (u < ts * 0.05)
    in_bay_v = np.abs(v) < width_at_u
    in_bay = in_bay_u & in_bay_v

    # Smooth depression: strongest at center of bay, fading at walls
    safe_width = np.maximum(width_at_u, 1e-10)
    v_norm = np.where(
        width_at_u > 1e-10,
        np.abs(v) / safe_width,
        np.ones_like(v),
    )
    depression = np.where(
        in_bay,
        bay_max_dep * (1.0 - _smoothstep(v_norm)) * t_bay,
        0.0,
    )

    return result - depression


# ── Mask registry ────────────────────────────────────────────────

_MASK_REGISTRY: dict[str, MaskFn] = {
    "coastal": identity_mask,
    "bay_harbor": bay_harbor_mask,
    "river_valley": identity_mask,
    "lakefront": identity_mask,
    "inland": identity_mask,
    "island": identity_mask,
    "peninsula": identity_mask,
    "delta": identity_mask,
}


def register_mask(geographic_setting: str, mask_fn: MaskFn) -> None:
    """Register (or replace) a mask function for a geographic setting."""
    _MASK_REGISTRY[geographic_setting] = mask_fn


def get_mask(geographic_setting: str) -> MaskFn:
    """Return the mask function for *geographic_setting*.

    Falls back to :func:`identity_mask` if no dedicated mask is registered.
    """
    return _MASK_REGISTRY.get(geographic_setting, identity_mask)


def apply_geographic_mask(
    heightfield: NDArray[np.float64],
    geographic_setting: str,
    tx: int,
    ty: int,
    tile_size: float,
    resolution: int,
    seed: int,
) -> NDArray[np.float64]:
    """Apply the geographic mask for *geographic_setting* to *heightfield*.

    This is the main entry point called by the terrain generator.
    It looks up the registered mask function, builds a
    :class:`MaskContext`, invokes the mask, and clamps the result
    to [0, 1].

    Args:
        heightfield: 2D numpy array of heights in [0, 1].
        geographic_setting: World type (e.g. ``"island"``, ``"inland"``).
        tx, ty: Tile coordinates.
        tile_size: Tile size in world units.
        resolution: Heightfield resolution (samples per edge).
        seed: World seed.

    Returns:
        Modified heightfield, clamped to [0, 1].
    """
    mask_fn = get_mask(geographic_setting)
    ctx = MaskContext(
        tx=tx,
        ty=ty,
        tile_size=tile_size,
        resolution=resolution,
        seed=seed,
    )
    result = mask_fn(heightfield, ctx)
    return np.clip(result, 0.0, 1.0)
