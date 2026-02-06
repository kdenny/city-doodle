"""Noise utilities for terrain generation using OpenSimplex."""

import numpy as np
from numpy.typing import NDArray
from opensimplex import OpenSimplex


class SeededNoise:
    """Deterministic noise generator with a fixed seed."""

    def __init__(self, seed: int) -> None:
        self.seed = seed
        self._simplex = OpenSimplex(seed=seed)

    def sample_2d(self, x: float, y: float) -> float:
        """Sample 2D noise at the given coordinates. Returns value in [-1, 1]."""
        return self._simplex.noise2(x, y)

    def octave_noise_2d(
        self,
        x: float,
        y: float,
        octaves: int = 6,
        persistence: float = 0.5,
        lacunarity: float = 2.0,
        scale: float = 1.0,
    ) -> float:
        """Generate fractal Brownian motion (fBm) noise.

        Args:
            x, y: World coordinates
            octaves: Number of noise layers to combine
            persistence: Amplitude multiplier per octave (typically 0.5)
            lacunarity: Frequency multiplier per octave (typically 2.0)
            scale: Base frequency scale

        Returns:
            Noise value approximately in [-1, 1]
        """
        total = 0.0
        amplitude = 1.0
        frequency = scale
        max_amplitude = 0.0

        for _ in range(octaves):
            total += amplitude * self.sample_2d(x * frequency, y * frequency)
            max_amplitude += amplitude
            amplitude *= persistence
            frequency *= lacunarity

        return total / max_amplitude


def generate_heightfield(
    seed: int,
    tx: int,
    ty: int,
    tile_size: float,
    resolution: int,
    octaves: int = 6,
    persistence: float = 0.5,
    lacunarity: float = 2.0,
    scale: float = 0.001,
) -> NDArray[np.float64]:
    """Generate a heightfield for a single tile.

    Args:
        seed: World seed for deterministic generation
        tx, ty: Tile coordinates
        tile_size: Size of tile in world units
        resolution: Number of samples per edge
        octaves: Noise octaves
        persistence: Amplitude decay
        lacunarity: Frequency growth
        scale: Base frequency scale

    Returns:
        2D numpy array of heights normalized to [0, 1]
    """
    noise = SeededNoise(seed)
    heightfield = np.zeros((resolution, resolution), dtype=np.float64)

    # Calculate world coordinates for each sample
    x_offset = tx * tile_size
    y_offset = ty * tile_size
    step = tile_size / resolution

    for i in range(resolution):
        for j in range(resolution):
            world_x = x_offset + j * step
            world_y = y_offset + i * step

            # Generate noise value
            value = noise.octave_noise_2d(
                world_x,
                world_y,
                octaves=octaves,
                persistence=persistence,
                lacunarity=lacunarity,
                scale=scale,
            )

            # Normalize from [-1, 1] to [0, 1]
            heightfield[i, j] = (value + 1.0) / 2.0

    return heightfield


def apply_erosion(
    heightfield: NDArray[np.float64],
    seed: int,
    iterations: int = 50,
    rain_amount: float = 0.01,
    evaporation: float = 0.5,
    sediment_capacity: float = 0.1,
) -> NDArray[np.float64]:
    """Apply simple hydraulic erosion to a heightfield.

    This simulates raindrops carrying sediment downhill.

    Args:
        heightfield: 2D height array
        seed: Random seed for deterministic erosion
        iterations: Number of rain drops to simulate
        rain_amount: Amount of water per drop
        evaporation: Rate of water loss
        sediment_capacity: How much sediment water can carry

    Returns:
        Eroded heightfield
    """
    result = heightfield.copy()
    h, w = result.shape
    rng = np.random.default_rng(seed)

    for _ in range(iterations * w):
        # Random starting position
        x, y = rng.integers(1, w - 1), rng.integers(1, h - 1)
        water = rain_amount
        sediment = 0.0

        for _ in range(100):  # Max steps per drop
            if x <= 0 or x >= w - 1 or y <= 0 or y >= h - 1:
                break

            # Find steepest descent
            current_height = result[y, x]
            min_height = current_height
            dx, dy = 0, 0

            for nx, ny in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]:
                if result[ny, nx] < min_height:
                    min_height = result[ny, nx]
                    dx, dy = nx - x, ny - y

            if dx == 0 and dy == 0:
                # Deposit sediment in flat area
                result[y, x] += sediment
                break

            # Calculate erosion/deposition
            height_diff = current_height - min_height
            capacity = height_diff * water * sediment_capacity

            if sediment > capacity:
                # Deposit excess sediment
                deposit = (sediment - capacity) * 0.3
                result[y, x] += deposit
                sediment -= deposit
            else:
                # Erode and pick up sediment
                erosion = min((capacity - sediment) * 0.3, height_diff * 0.5)
                result[y, x] -= erosion
                sediment += erosion

            # Move to lower cell
            x, y = x + dx, y + dy
            water *= 1.0 - evaporation

            if water < 0.001:
                break

    return result
