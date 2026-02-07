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


def river_valley_mask(
    heightfield: NDArray[np.float64], ctx: MaskContext
) -> NDArray[np.float64]:
    """Meandering valley channel mask for river-valley worlds (CITY-391).

    Carves a deliberate river valley through the terrain.  The valley
    has a meandering centerline, a narrow deep river channel, and
    wider valley slopes on either side.  Direction and meander phase
    are seed-deterministic.

    The mask *subtracts* height near the river rather than multiplying,
    so terrain far from the river keeps its full noise-derived variation
    while the valley itself is depressed below the water level.
    """
    res = ctx.resolution
    ts = ctx.tile_size

    # World center
    cx = ts * 0.5
    cy = ts * 0.5

    # Seed-based river direction (0 to π — half circle is sufficient)
    direction = _seeded_hash(ctx.seed, 20) * math.pi

    # Meander parameters
    meander_amp = ts * 0.15
    meander_freq = 2.0 * math.pi / (ts * 2.0)
    meander_phase = _seeded_hash(ctx.seed, 21) * 2.0 * math.pi
    # Second harmonic for more natural meanders
    meander_amp2 = ts * 0.06
    meander_freq2 = meander_freq * 2.3
    meander_phase2 = _seeded_hash(ctx.seed, 22) * 2.0 * math.pi

    # Valley geometry
    river_half_w = ts * 0.03    # River channel half-width
    valley_half_w = ts * 0.25   # Full valley half-width
    max_depression = 0.4        # Max height reduction at river bottom

    # Build world-coordinate grids
    step = ts / res
    xs = ctx.tx * ts + np.arange(res, dtype=np.float64) * step
    ys = ctx.ty * ts + np.arange(res, dtype=np.float64) * step
    xx, yy = np.meshgrid(xs, ys)

    dx = xx - cx
    dy = yy - cy

    # Rotate to river-aligned coordinates
    cos_d, sin_d = math.cos(direction), math.sin(direction)
    u = dx * cos_d + dy * sin_d    # Along river
    v = -dx * sin_d + dy * cos_d   # Perpendicular

    # Meandering centerline offset
    meander = (
        meander_amp * np.sin(u * meander_freq + meander_phase)
        + meander_amp2 * np.sin(u * meander_freq2 + meander_phase2)
    )

    # Perpendicular distance from the meandering centerline
    dist = np.abs(v - meander)

    # Valley profile: two-zone cross-section
    #   1. River channel (dist < river_half_w): full depression
    #   2. Valley walls (river_half_w < dist < valley_half_w): smooth rise
    #   3. Beyond valley: no change
    t = np.clip(
        (dist - river_half_w) / np.maximum(valley_half_w - river_half_w, 1e-10),
        0.0,
        1.0,
    )
    depression = max_depression * (1.0 - _smoothstep(t))

    return heightfield - depression


# ── Mask registry ────────────────────────────────────────────────

_MASK_REGISTRY: dict[str, MaskFn] = {
    "coastal": identity_mask,
    "bay_harbor": identity_mask,
    "river_valley": river_valley_mask,
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
