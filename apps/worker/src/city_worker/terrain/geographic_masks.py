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
    u = dx * cos_d + dy * sin_d    # Along axis (mainland → tip)
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
    # (along_mask already 1.0 there — no change needed)

    # Combine
    mask = perp_mask * along_mask

    # Noise perturbation for organic coastline
    angles = np.arctan2(dy, dx)
    noise = _angle_noise(angles, ctx.seed + 500)
    mask = mask + noise * 0.04
    mask = np.clip(mask, 0.0, 1.0)

    return heightfield * mask


def delta_mask(
    heightfield: NDArray[np.float64], ctx: MaskContext
) -> NDArray[np.float64]:
    """Fan-shaped river-mouth mask for delta worlds (CITY-393).

    Creates a river delta by:
      1. Flattening the fan region (low-lying terrain near water level).
      2. Carving radiating channel depressions that fan out from an
         apex point toward the ocean.
      3. Leaving narrow strips between channels as delta islands.

    The ocean direction and number of channels are seed-deterministic.
    """
    res = ctx.resolution
    ts = ctx.tile_size
    cx, cy = ts * 0.5, ts * 0.5

    # Ocean direction
    ocean_dir = _seeded_hash(ctx.seed, 40) * 2.0 * math.pi
    cos_d, sin_d = math.cos(ocean_dir), math.sin(ocean_dir)

    # Fan apex: slightly behind center (inland side)
    apex_x = cx - 0.3 * ts * cos_d
    apex_y = cy - 0.3 * ts * sin_d

    # Fan parameters
    fan_half_angle = math.pi * 0.35  # ~63° half-spread → 126° total
    fan_length = ts * 1.2            # How far the fan extends toward ocean
    num_channels = 5 + int(_seeded_hash(ctx.seed, 41) * 4)  # 5-8

    # Channel half-widths (widen toward ocean)
    channel_base_hw = ts * 0.015
    channel_tip_hw = ts * 0.04
    channel_depression = 0.35

    # Build world-coordinate grids
    step = ts / res
    xs = ctx.tx * ts + np.arange(res, dtype=np.float64) * step
    ys = ctx.ty * ts + np.arange(res, dtype=np.float64) * step
    xx, yy = np.meshgrid(xs, ys)

    dx = xx - apex_x
    dy = yy - apex_y

    # Distance and angle from apex
    dist = np.sqrt(dx * dx + dy * dy)
    angles = np.arctan2(dy, dx)

    # Angle relative to ocean direction (wrapped to [-π, π])
    rel_angle = np.arctan2(
        np.sin(angles - ocean_dir), np.cos(angles - ocean_dir)
    )

    # ── Step 1: Fan-region flattening ──
    # Inside the fan cone and within fan_length: flatten terrain
    in_fan = (np.abs(rel_angle) < fan_half_angle) & (dist < fan_length)
    # Flatten = compress toward a low value
    flat_target = 0.35  # Just at/near water level for delta preset
    t_flat = np.where(in_fan, 0.4, 0.0)  # 40% blend toward flat
    result = heightfield * (1.0 - t_flat) + flat_target * t_flat

    # ── Step 2: Channel depressions ──
    # Radiating channels from apex within the fan
    depression = np.zeros_like(result)
    for i in range(num_channels):
        # Channel angle: evenly spread across the fan
        t_ch = (i + 0.5) / num_channels
        ch_angle = ocean_dir + fan_half_angle * (2.0 * t_ch - 1.0)
        # Slight random wobble
        ch_angle += (_seeded_hash(ctx.seed, 50 + i) - 0.5) * 0.08

        # Perpendicular distance from channel line
        ch_cos, ch_sin = math.cos(ch_angle), math.sin(ch_angle)
        # Project onto channel line: u_ch = along channel, v_ch = perp
        u_ch = dx * ch_cos + dy * ch_sin
        v_ch = np.abs(-dx * ch_sin + dy * ch_cos)

        # Channel width widens with distance from apex
        t_dist = np.clip(u_ch / fan_length, 0.0, 1.0)
        ch_hw = channel_base_hw + (channel_tip_hw - channel_base_hw) * t_dist

        # Only apply where u_ch > 0 (in front of apex, toward ocean)
        # and within the channel width
        safe_hw = np.maximum(ch_hw, 1e-10)
        ch_mask = (u_ch > 0) & (u_ch < fan_length) & (v_ch < ch_hw)
        ch_strength = np.where(
            ch_mask,
            channel_depression * (1.0 - _smoothstep(v_ch / safe_hw)),
            0.0,
        )
        depression = np.maximum(depression, ch_strength)

    # ── Step 3: Feeder river (single channel entering from inland) ──
    feeder_dir = ocean_dir + math.pi  # Opposite of ocean = inland
    f_cos, f_sin = math.cos(feeder_dir), math.sin(feeder_dir)
    u_f = dx * f_cos + dy * f_sin
    v_f = np.abs(-dx * f_sin + dy * f_cos)
    feeder_hw = ts * 0.03
    safe_feeder = np.maximum(feeder_hw, 1e-10)
    feeder_mask = (u_f > 0) & (v_f < feeder_hw)
    feeder_dep = np.where(
        feeder_mask,
        0.3 * (1.0 - _smoothstep(v_f / safe_feeder)),
        0.0,
    )
    depression = np.maximum(depression, feeder_dep)

    return result - depression


# ── Mask registry ────────────────────────────────────────────────

_MASK_REGISTRY: dict[str, MaskFn] = {
    "coastal": identity_mask,
    "bay_harbor": identity_mask,
    "river_valley": identity_mask,
    "lakefront": identity_mask,
    "inland": identity_mask,
    "island": island_mask,
    "peninsula": peninsula_mask,
    "delta": delta_mask,
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
