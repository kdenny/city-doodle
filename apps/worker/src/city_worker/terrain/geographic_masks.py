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


def peninsula_mask(
    heightfield: NDArray[np.float64], ctx: MaskContext
) -> NDArray[np.float64]:
    """Directional land-protrusion mask for peninsula worlds (CITY-390).

    Creates a finger of land jutting into water.  The peninsula axis
    direction is seed-deterministic.  The landmass is wide at the
    "mainland" end and tapers toward the tip, with water on both sides
    and at the tip.
    """
    res = ctx.resolution
    ts = ctx.tile_size

    # World center (middle of tile 0,0)
    cx = ts * 0.5
    cy = ts * 0.5

    # Seed-based direction the peninsula points toward
    direction = _seeded_hash(ctx.seed, 10) * 2.0 * math.pi

    # Peninsula geometry (in rotated coordinates along the axis)
    mainland_u = -ts * 0.8   # Where the mainland starts (behind center)
    tip_u = ts * 1.0         # Where the tip ends (past center)
    base_half_w = ts * 0.9   # Half-width at mainland
    tip_half_w = ts * 0.12   # Half-width at tip
    tip_falloff = ts * 0.25  # Falloff distance beyond the tip

    # Build world-coordinate grids
    step = ts / res
    xs = ctx.tx * ts + np.arange(res, dtype=np.float64) * step
    ys = ctx.ty * ts + np.arange(res, dtype=np.float64) * step
    xx, yy = np.meshgrid(xs, ys)

    dx = xx - cx
    dy = yy - cy

    # Rotate into peninsula-aligned coordinate system
    cos_d, sin_d = math.cos(direction), math.sin(direction)
    u = dx * cos_d + dy * sin_d    # Along axis (mainland -> tip)
    v = -dx * sin_d + dy * cos_d   # Perpendicular

    # Interpolate half-width along the axis
    t_along = np.clip((u - mainland_u) / (tip_u - mainland_u), 0.0, 1.0)
    half_width = base_half_w + (tip_half_w - base_half_w) * t_along

    # Perpendicular falloff: 1.0 on axis, drops to 0 at edges
    v_norm = np.abs(v) / np.maximum(half_width, 1e-10)
    perp_mask = 1.0 - _smoothstep(v_norm)

    # Along-axis falloff: land from mainland to tip, then fall off
    along_mask = np.ones_like(u)
    # Beyond the tip: smooth falloff
    beyond_tip = u > tip_u
    along_mask[beyond_tip] = 1.0 - _smoothstep(
        (u[beyond_tip] - tip_u) / tip_falloff
    ).astype(np.float64)
    # Behind mainland: always land (continent continues)
    # (along_mask already 1.0 there -- no change needed)

    # Combine
    mask = perp_mask * along_mask

    # Noise perturbation for organic coastline
    angles = np.arctan2(dy, dx)
    noise = _angle_noise(angles, ctx.seed + 500)
    mask = mask + noise * 0.04
    mask = np.clip(mask, 0.0, 1.0)

    return heightfield * mask


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

    # Seed-based river direction (0 to pi -- half circle is sufficient)
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
    "river_valley": river_valley_mask,
    "lakefront": identity_mask,
    "inland": identity_mask,
    "island": island_mask,
    "peninsula": peninsula_mask,
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
