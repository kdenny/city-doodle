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


def _angle_noise(
    angles: NDArray[np.float64], seed: int, octaves: int = 4
) -> NDArray[np.float64]:
    """Deterministic noise keyed on angle for organic boundary perturbation.

    Returns values roughly in [-1, 1].
    """
    result = np.zeros_like(angles)
    amplitude = 1.0
    total_amp = 0.0
    for i in range(octaves):
        phase = _seeded_hash(seed, i + 100) * 2.0 * math.pi
        freq = float(i + 2)
        result += amplitude * np.sin(angles * freq + phase)
        total_amp += amplitude
        amplitude *= 0.5
    return result / total_amp


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


def island_mask(
    heightfield: NDArray[np.float64], ctx: MaskContext
) -> NDArray[np.float64]:
    """Radial falloff mask for island worlds (CITY-387).

    Multiplies the heightfield by a smooth radial falloff centered on
    the world origin (middle of tile 0, 0).  The falloff edge is
    perturbed by angle-dependent noise for an organic coastline, and
    the island shape is slightly elliptical based on the seed.
    """
    res = ctx.resolution
    ts = ctx.tile_size

    # Island center: middle of tile (0, 0)
    cx = ts * 0.5
    cy = ts * 0.5

    # Base radius and transition band
    base_radius = ts * 0.7
    falloff_width = ts * 0.35

    # Seed-derived eccentricity for variety
    aspect = 0.85 + _seeded_hash(ctx.seed, 0) * 0.30  # 0.85 – 1.15
    rotation = _seeded_hash(ctx.seed, 1) * math.pi     # 0 – π

    # Build world-coordinate grids
    step = ts / res
    xs = ctx.tx * ts + np.arange(res, dtype=np.float64) * step
    ys = ctx.ty * ts + np.arange(res, dtype=np.float64) * step
    xx, yy = np.meshgrid(xs, ys)

    dx = xx - cx
    dy = yy - cy

    # Rotate + stretch for elliptical shape
    cos_r, sin_r = math.cos(rotation), math.sin(rotation)
    rx = dx * cos_r + dy * sin_r
    ry = (-dx * sin_r + dy * cos_r) * aspect
    dist = np.sqrt(rx * rx + ry * ry)

    # Angle-dependent noise for organic shoreline
    angles = np.arctan2(dy, dx)
    noise = _angle_noise(angles, ctx.seed)
    perturbed_radius = np.maximum(base_radius + noise * ts * 0.15, ts * 0.2)

    # Smooth radial falloff
    inner = perturbed_radius - falloff_width * 0.5
    outer = perturbed_radius + falloff_width * 0.5
    t = (dist - inner) / np.maximum(outer - inner, 1e-10)
    mask = 1.0 - _smoothstep(t)

    return heightfield * mask


# ── Mask registry ────────────────────────────────────────────────

_MASK_REGISTRY: dict[str, MaskFn] = {
    "coastal": identity_mask,
    "bay_harbor": identity_mask,
    "river_valley": identity_mask,
    "lakefront": identity_mask,
    "inland": identity_mask,
    "island": island_mask,
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
