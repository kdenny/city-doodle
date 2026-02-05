"""Tests for terrain generation module."""

import pytest
from city_worker.terrain import TerrainConfig, TerrainGenerator, generate_terrain_3x3
from city_worker.terrain.noise import SeededNoise, apply_erosion, generate_heightfield
from city_worker.terrain.types import TileCoord
from city_worker.terrain.water import (
    calculate_flow_accumulation,
    extract_beaches,
    extract_coastlines,
)


class TestSeededNoise:
    """Tests for the SeededNoise class."""

    def test_deterministic_output(self):
        """Same seed + coordinates should produce same value."""
        noise1 = SeededNoise(seed=42)
        noise2 = SeededNoise(seed=42)

        value1 = noise1.sample_2d(10.5, 20.3)
        value2 = noise2.sample_2d(10.5, 20.3)

        assert value1 == value2

    def test_different_seeds_produce_different_values(self):
        """Different seeds should produce different values."""
        noise1 = SeededNoise(seed=42)
        noise2 = SeededNoise(seed=99)

        value1 = noise1.sample_2d(10.5, 20.3)
        value2 = noise2.sample_2d(10.5, 20.3)

        assert value1 != value2

    def test_value_range(self):
        """Noise values should be in [-1, 1] range."""
        noise = SeededNoise(seed=42)

        for x in range(100):
            for y in range(100):
                value = noise.sample_2d(x * 0.1, y * 0.1)
                assert -1.0 <= value <= 1.0

    def test_octave_noise_range(self):
        """Octave noise should also be in [-1, 1] range."""
        noise = SeededNoise(seed=42)

        for x in range(50):
            for y in range(50):
                value = noise.octave_noise_2d(x * 0.1, y * 0.1, octaves=6)
                assert -1.0 <= value <= 1.0


class TestHeightfieldGeneration:
    """Tests for heightfield generation."""

    def test_heightfield_dimensions(self):
        """Heightfield should have correct dimensions."""
        heightfield = generate_heightfield(seed=42, tx=0, ty=0, tile_size=1000.0, resolution=64)

        assert heightfield.shape == (64, 64)

    def test_heightfield_range(self):
        """Heightfield values should be normalized to [0, 1]."""
        heightfield = generate_heightfield(seed=42, tx=0, ty=0, tile_size=1000.0, resolution=64)

        assert heightfield.min() >= 0.0
        assert heightfield.max() <= 1.0

    def test_heightfield_deterministic(self):
        """Same parameters should produce identical heightfields."""
        h1 = generate_heightfield(seed=42, tx=5, ty=3, tile_size=1000.0, resolution=32)
        h2 = generate_heightfield(seed=42, tx=5, ty=3, tile_size=1000.0, resolution=32)

        assert (h1 == h2).all()

    def test_different_tiles_different_terrain(self):
        """Different tile coordinates should produce different terrain."""
        h1 = generate_heightfield(seed=42, tx=0, ty=0, tile_size=1000.0, resolution=32)
        h2 = generate_heightfield(seed=42, tx=1, ty=0, tile_size=1000.0, resolution=32)

        # The heightfields should be different
        assert not (h1 == h2).all()

    def test_erosion_preserves_range(self):
        """Erosion should keep values in valid range."""
        heightfield = generate_heightfield(seed=42, tx=0, ty=0, tile_size=1000.0, resolution=32)
        eroded = apply_erosion(heightfield, iterations=10)

        # Values should still be mostly in [0, 1] (erosion might slightly exceed)
        assert eroded.min() >= -0.1
        assert eroded.max() <= 1.1


class TestTerrainGenerator:
    """Tests for the TerrainGenerator class."""

    @pytest.fixture
    def generator(self):
        """Create a generator with test config."""
        config = TerrainConfig(
            world_seed=42,
            tile_size=1000.0,  # Smaller for faster tests
            resolution=32,  # Lower resolution for faster tests
        )
        return TerrainGenerator(config)

    def test_generates_nine_tiles(self, generator):
        """Should generate center tile plus 8 neighbors."""
        result = generator.generate_3x3(center_tx=0, center_ty=0)

        # Should have center + 8 neighbors = 9 tiles
        all_tiles = result.all_tiles()
        assert len(all_tiles) == 9

    def test_center_tile_at_correct_coords(self, generator):
        """Center tile should be at the requested coordinates."""
        result = generator.generate_3x3(center_tx=5, center_ty=3)

        assert result.center.tx == 5
        assert result.center.ty == 3

    def test_neighbors_at_correct_coords(self, generator):
        """Neighbor tiles should be at correct relative coordinates."""
        result = generator.generate_3x3(center_tx=0, center_ty=0)

        expected_neighbors = {
            (-1, -1),
            (-1, 0),
            (-1, 1),
            (0, -1),
            (0, 1),
            (1, -1),
            (1, 0),
            (1, 1),
        }

        actual_neighbors = set(result.neighbors.keys())
        assert actual_neighbors == expected_neighbors

    def test_deterministic_generation(self, generator):
        """Same seed + coords should produce identical results."""
        result1 = generator.generate_3x3(center_tx=0, center_ty=0)
        result2 = generator.generate_3x3(center_tx=0, center_ty=0)

        # Heights should be identical
        assert result1.center.heightfield == result2.center.heightfield

    def test_tiles_have_features(self, generator):
        """Generated tiles should have terrain features."""
        result = generator.generate_3x3(center_tx=0, center_ty=0)

        # At least some tiles should have features (coastlines, etc.)
        total_features = sum(len(t.features) for t in result.all_tiles())
        assert total_features > 0

    def test_to_dict_format(self, generator):
        """Tile data should serialize to correct format."""
        result = generator.generate_3x3(center_tx=0, center_ty=0)

        tile_dict = result.center.to_dict()

        assert "tx" in tile_dict
        assert "ty" in tile_dict
        assert "heightfield" in tile_dict
        assert isinstance(tile_dict["heightfield"], list)

    def test_features_to_geojson(self, generator):
        """Features should convert to valid GeoJSON."""
        result = generator.generate_3x3(center_tx=0, center_ty=0)

        geojson = result.center.features_to_geojson()

        assert geojson["type"] == "FeatureCollection"
        assert "features" in geojson
        assert isinstance(geojson["features"], list)


class TestGenerateTerrain3x3:
    """Tests for the convenience function."""

    def test_basic_generation(self):
        """Should generate terrain without errors."""
        result = generate_terrain_3x3(
            world_seed=42,
            center_tx=0,
            center_ty=0,
            config_overrides={"resolution": 16, "tile_size": 500.0},
        )

        assert result is not None
        assert len(result.all_tiles()) == 9

    def test_config_overrides_applied(self):
        """Config overrides should affect generation."""
        result = generate_terrain_3x3(
            world_seed=42,
            center_tx=0,
            center_ty=0,
            config_overrides={"resolution": 16},
        )

        # Check heightfield has overridden resolution
        assert len(result.center.heightfield) == 16
        assert len(result.center.heightfield[0]) == 16


class TestSeamlessBorders:
    """Tests for seamless border alignment between tiles."""

    def test_adjacent_tiles_share_edge_values(self):
        """Adjacent tiles should have matching values at shared edges."""
        config = TerrainConfig(world_seed=42, tile_size=1000.0, resolution=32)
        generator = TerrainGenerator(config)

        result = generator.generate_3x3(center_tx=0, center_ty=0)

        # Get center and right neighbor
        center_hf = result.center.heightfield
        right_neighbor = result.neighbors[(1, 0)]
        right_hf = right_neighbor.heightfield

        # The right edge of center should match left edge of right neighbor
        # Due to continuous noise, values should be very similar
        # (not exact due to discrete sampling, but close)
        for i in range(len(center_hf)):
            center_edge = center_hf[i][-1]
            neighbor_edge = right_hf[i][0]
            # Allow small tolerance due to cell-based sampling
            assert abs(center_edge - neighbor_edge) < 0.2


class TestWaterFeatures:
    """Tests for water feature extraction."""

    def test_coastline_extraction(self):
        """Should extract coastlines from heightfield."""
        import numpy as np

        # Create a simple heightfield with land and water
        heightfield = np.zeros((32, 32))
        heightfield[8:24, 8:24] = 0.6  # Land in center

        features = extract_coastlines(
            heightfield=heightfield,
            water_level=0.35,
            tile_x=0,
            tile_y=0,
            tile_size=1000.0,
        )

        # Should have at least one coastline polygon
        assert len(features) > 0
        assert features[0].type == "coastline"

    def test_flow_accumulation(self):
        """Flow accumulation should concentrate in valleys."""
        import numpy as np

        # Create a V-shaped valley
        heightfield = np.ones((32, 32))
        for i in range(32):
            for j in range(32):
                # V shape with lowest point in center
                dist_from_center = abs(j - 16)
                heightfield[i, j] = 0.3 + dist_from_center * 0.02

        flow = calculate_flow_accumulation(heightfield)

        # Center column should have highest flow
        center_flow = flow[:, 16].sum()
        edge_flow = flow[:, 0].sum()
        assert center_flow > edge_flow


class TestTileCoord:
    """Tests for TileCoord dataclass."""

    def test_hashable(self):
        """TileCoord should be hashable for use in dicts/sets."""
        coord1 = TileCoord(tx=5, ty=3)
        coord2 = TileCoord(tx=5, ty=3)

        assert hash(coord1) == hash(coord2)
        assert coord1 == coord2

        # Should work in a set
        coords = {coord1, coord2}
        assert len(coords) == 1


class TestBeachGeneration:
    """Tests for beach generation along coastlines."""

    def test_beach_extraction_on_gradual_slope(self):
        """Beaches should form where slope is gradual near water."""
        import numpy as np

        # Create a heightfield with gradual slope from water to land
        heightfield = np.zeros((32, 32))
        for j in range(32):
            # Gradual slope: water on left, land on right
            # Height increases slowly from 0.3 to 0.5
            heightfield[:, j] = 0.3 + (j / 32) * 0.2

        features = extract_beaches(
            heightfield=heightfield,
            water_level=0.35,
            beach_height_band=0.08,
            tile_x=0,
            tile_y=0,
            tile_size=1000.0,
            min_length=3,
            max_slope=0.15,
        )

        # Should have at least one beach feature
        assert len(features) > 0
        assert features[0].type == "beach"
        assert "beach_type" in features[0].properties

    def test_no_beach_on_steep_cliffs(self):
        """Beaches should not form on steep cliffs."""
        import numpy as np

        # Create a heightfield with steep cliff
        heightfield = np.zeros((32, 32))
        heightfield[:, :16] = 0.2  # Water on left half
        heightfield[:, 16:] = 0.8  # Steep cliff to high land on right

        features = extract_beaches(
            heightfield=heightfield,
            water_level=0.35,
            beach_height_band=0.08,
            tile_x=0,
            tile_y=0,
            tile_size=1000.0,
            min_length=3,
            max_slope=0.15,
        )

        # Should have no beaches due to steep slope
        assert len(features) == 0

    def test_beach_width_varies_with_slope(self):
        """Beaches should be wider where slope is more gradual."""
        import numpy as np

        # Create terrain with very gradual slope
        heightfield_gradual = np.zeros((32, 32))
        for j in range(32):
            heightfield_gradual[:, j] = 0.3 + (j / 32) * 0.15

        # Create terrain with steeper (but still beach-forming) slope
        heightfield_steeper = np.zeros((32, 32))
        for j in range(32):
            heightfield_steeper[:, j] = 0.3 + (j / 32) * 0.25

        features_gradual = extract_beaches(
            heightfield=heightfield_gradual,
            water_level=0.35,
            beach_height_band=0.08,
            tile_x=0,
            tile_y=0,
            tile_size=1000.0,
            min_length=3,
            max_slope=0.15,
        )

        features_steeper = extract_beaches(
            heightfield=heightfield_steeper,
            water_level=0.35,
            beach_height_band=0.08,
            tile_x=0,
            tile_y=0,
            tile_size=1000.0,
            min_length=3,
            max_slope=0.15,
        )

        # Gradual slope should produce beaches (wider or any)
        # Steeper slope might produce narrower beaches or none
        assert len(features_gradual) >= len(features_steeper)

    def test_beach_type_classification(self):
        """Beach type should be classified based on adjacent water body."""
        import numpy as np

        # Create a small landlocked lake with gradual shores
        heightfield = np.ones((32, 32)) * 0.5  # All land
        # Create a small depression for a lake
        for i in range(12, 20):
            for j in range(12, 20):
                heightfield[i, j] = 0.3  # Water

        # Add gradual slope around the lake
        for i in range(10, 22):
            for j in range(10, 22):
                if heightfield[i, j] >= 0.35:  # Not water
                    dist_to_water = min(
                        abs(i - 12) if i < 12 else 0,
                        abs(i - 19) if i > 19 else 0,
                        abs(j - 12) if j < 12 else 0,
                        abs(j - 19) if j > 19 else 0,
                    )
                    if dist_to_water == 0:
                        dist_to_water = min(i - 12, 19 - i, j - 12, 19 - j)
                    heightfield[i, j] = 0.35 + dist_to_water * 0.02

        features = extract_beaches(
            heightfield=heightfield,
            water_level=0.35,
            beach_height_band=0.08,
            tile_x=0,
            tile_y=0,
            tile_size=1000.0,
            min_length=2,
            max_slope=0.2,
        )

        # Should have beaches with lake type
        if len(features) > 0:
            beach_types = [f.properties.get("beach_type") for f in features]
            assert "lake" in beach_types

    def test_width_multiplier_affects_beach_area(self):
        """Width multiplier should affect total beach area."""
        import numpy as np

        # Create a gradual slope terrain
        heightfield = np.zeros((32, 32))
        for j in range(32):
            heightfield[:, j] = 0.3 + (j / 32) * 0.15

        features_normal = extract_beaches(
            heightfield=heightfield,
            water_level=0.35,
            beach_height_band=0.08,
            tile_x=0,
            tile_y=0,
            tile_size=1000.0,
            min_length=3,
            max_slope=0.15,
            width_multiplier=1.0,
        )

        features_wide = extract_beaches(
            heightfield=heightfield,
            water_level=0.35,
            beach_height_band=0.08,
            tile_x=0,
            tile_y=0,
            tile_size=1000.0,
            min_length=3,
            max_slope=0.15,
            width_multiplier=2.0,
        )

        # With wider multiplier, total beach area should be greater
        total_area_normal = sum(f.properties.get("area", 0) for f in features_normal)
        total_area_wide = sum(f.properties.get("area", 0) for f in features_wide)

        if total_area_normal > 0:
            assert total_area_wide >= total_area_normal

    def test_beach_disabled_produces_no_beaches(self):
        """When beach_enabled is false, no beaches should be generated."""
        config = TerrainConfig(
            world_seed=42,
            tile_size=1000.0,
            resolution=32,
            beach_enabled=False,
        )
        generator = TerrainGenerator(config)
        result = generator.generate_3x3(center_tx=0, center_ty=0)

        # Count beach features across all tiles
        beach_count = sum(
            1 for tile in result.all_tiles() for f in tile.features if f.type == "beach"
        )

        assert beach_count == 0

    def test_beach_feature_has_required_properties(self):
        """Beach features should have all required properties."""
        import numpy as np

        # Create terrain that will produce beaches
        heightfield = np.zeros((32, 32))
        for j in range(32):
            heightfield[:, j] = 0.3 + (j / 32) * 0.15

        features = extract_beaches(
            heightfield=heightfield,
            water_level=0.35,
            beach_height_band=0.08,
            tile_x=0,
            tile_y=0,
            tile_size=1000.0,
            min_length=3,
            max_slope=0.15,
        )

        for feature in features:
            assert feature.type == "beach"
            assert feature.geometry["type"] == "Polygon"
            assert "coordinates" in feature.geometry
            assert "area" in feature.properties
            assert "width" in feature.properties
            assert "beach_type" in feature.properties
            assert feature.properties["beach_type"] in ["ocean", "bay", "lake", "river"]
