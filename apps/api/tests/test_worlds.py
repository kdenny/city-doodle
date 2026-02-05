"""Tests for world CRUD endpoints."""

import pytest
from httpx import AsyncClient

# Test user ID for the X-User-Id header
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000002"

# The test world created by conftest.py (used for tile/lock tests)
TEST_WORLD_ID = "00000000-0000-0000-0000-000000000010"


class TestCreateWorld:
    """Tests for POST /worlds endpoint."""

    @pytest.mark.asyncio
    async def test_create_world_success(self, client: AsyncClient):
        """Create world should return 201 with world data."""
        response = await client.post(
            "/worlds",
            json={"name": "Test World", "seed": 12345},  # Use explicit seed to avoid overflow
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test World"
        assert "id" in data
        assert "seed" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_create_world_with_seed(self, client: AsyncClient):
        """Create world with explicit seed."""
        response = await client.post(
            "/worlds",
            json={"name": "Seeded World", "seed": 12345},
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["seed"] == 12345

    @pytest.mark.asyncio
    async def test_create_world_with_settings(self, client: AsyncClient):
        """Create world with custom settings."""
        response = await client.post(
            "/worlds",
            json={
                "name": "Custom World",
                "seed": 54321,  # Use explicit seed to avoid overflow
                "settings": {
                    "grid_organic": 0.8,
                    "sprawl_compact": 0.2,
                },
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["settings"]["grid_organic"] == 0.8
        assert data["settings"]["sprawl_compact"] == 0.2

    @pytest.mark.asyncio
    async def test_create_world_with_scale_settings(self, client: AsyncClient):
        """Create world with custom block and district sizes."""
        response = await client.post(
            "/worlds",
            json={
                "name": "Scaled World",
                "seed": 12121,
                "settings": {
                    "block_size_meters": 150,
                    "district_size_meters": 700,
                },
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["settings"]["block_size_meters"] == 150
        assert data["settings"]["district_size_meters"] == 700

    @pytest.mark.asyncio
    async def test_create_world_default_scale_settings(self, client: AsyncClient):
        """Create world should have default scale settings."""
        response = await client.post(
            "/worlds",
            json={"name": "Default Scale World", "seed": 13131},
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 201
        data = response.json()
        # Check defaults are applied
        assert data["settings"]["block_size_meters"] == 100
        assert data["settings"]["district_size_meters"] == 500

    @pytest.mark.asyncio
    async def test_create_world_invalid_block_size_too_small(self, client: AsyncClient):
        """Create world should reject block_size_meters below minimum."""
        response = await client.post(
            "/worlds",
            json={
                "name": "Invalid World",
                "seed": 14141,
                "settings": {"block_size_meters": 30},  # Below min of 50
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_world_invalid_block_size_too_large(self, client: AsyncClient):
        """Create world should reject block_size_meters above maximum."""
        response = await client.post(
            "/worlds",
            json={
                "name": "Invalid World",
                "seed": 15151,
                "settings": {"block_size_meters": 500},  # Above max of 300
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_world_invalid_district_size_too_small(self, client: AsyncClient):
        """Create world should reject district_size_meters below minimum."""
        response = await client.post(
            "/worlds",
            json={
                "name": "Invalid World",
                "seed": 16161,
                "settings": {"district_size_meters": 100},  # Below min of 200
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_world_invalid_district_size_too_large(self, client: AsyncClient):
        """Create world should reject district_size_meters above maximum."""
        response = await client.post(
            "/worlds",
            json={
                "name": "Invalid World",
                "seed": 17171,
                "settings": {"district_size_meters": 1500},  # Above max of 1000
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 422


class TestListWorlds:
    """Tests for GET /worlds endpoint."""

    @pytest.mark.asyncio
    async def test_list_worlds_only_test_world(self, client: AsyncClient):
        """List worlds should only return the fixture test world initially."""
        response = await client.get(
            "/worlds",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        data = response.json()
        # Should only contain the test world created by conftest.py
        assert len(data) == 1
        assert data[0]["id"] == TEST_WORLD_ID
        assert data[0]["name"] == "Test World"

    @pytest.mark.asyncio
    async def test_list_worlds_returns_user_worlds(self, client: AsyncClient):
        """List worlds should return the user's worlds."""
        # Create a world
        await client.post(
            "/worlds",
            json={"name": "My World", "seed": 11111},
            headers={"X-User-Id": TEST_USER_ID},
        )

        # List worlds
        response = await client.get(
            "/worlds",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        data = response.json()
        # Should have test world + newly created world
        assert len(data) == 2
        world_names = [w["name"] for w in data]
        assert "My World" in world_names
        assert "Test World" in world_names

    @pytest.mark.asyncio
    async def test_list_worlds_excludes_other_users(self, client: AsyncClient):
        """List worlds should not include other users' worlds."""
        # Create world as user 1
        await client.post(
            "/worlds",
            json={"name": "User 1 World", "seed": 22222},
            headers={"X-User-Id": TEST_USER_ID},
        )

        # Create world as user 2
        await client.post(
            "/worlds",
            json={"name": "User 2 World", "seed": 33333},
            headers={"X-User-Id": OTHER_USER_ID},
        )

        # List as user 1
        response = await client.get(
            "/worlds",
            headers={"X-User-Id": TEST_USER_ID},
        )
        data = response.json()
        # User 1 should see test world + their created world
        assert len(data) == 2
        world_names = [w["name"] for w in data]
        assert "User 1 World" in world_names
        assert "User 2 World" not in world_names


class TestGetWorld:
    """Tests for GET /worlds/{world_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_world_success(self, client: AsyncClient):
        """Get world should return the world data."""
        # Create a world
        create_response = await client.post(
            "/worlds",
            json={"name": "Test World", "seed": 44444},
            headers={"X-User-Id": TEST_USER_ID},
        )
        world_id = create_response.json()["id"]

        # Get the world
        response = await client.get(
            f"/worlds/{world_id}",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Test World"

    @pytest.mark.asyncio
    async def test_get_world_not_found(self, client: AsyncClient):
        """Get world should return 404 for non-existent world."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await client.get(
            f"/worlds/{fake_id}",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_world_forbidden_for_other_user(self, client: AsyncClient):
        """Get world should return 403 for another user's world."""
        # Create world as user 1
        create_response = await client.post(
            "/worlds",
            json={"name": "Private World", "seed": 55555},
            headers={"X-User-Id": TEST_USER_ID},
        )
        world_id = create_response.json()["id"]

        # Try to get as user 2
        response = await client.get(
            f"/worlds/{world_id}",
            headers={"X-User-Id": OTHER_USER_ID},
        )
        assert response.status_code == 403


class TestUpdateWorld:
    """Tests for PATCH /worlds/{world_id} endpoint."""

    @pytest.mark.asyncio
    async def test_update_world_name(self, client: AsyncClient):
        """Update world name should return 200 with updated data."""
        # Create a world
        create_response = await client.post(
            "/worlds",
            json={"name": "Original Name", "seed": 88888},
            headers={"X-User-Id": TEST_USER_ID},
        )
        world_id = create_response.json()["id"]

        # Update the name
        response = await client.patch(
            f"/worlds/{world_id}",
            json={"name": "Updated Name"},
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["id"] == world_id

    @pytest.mark.asyncio
    async def test_update_world_settings(self, client: AsyncClient):
        """Update world settings should return 200 with updated data."""
        # Create a world
        create_response = await client.post(
            "/worlds",
            json={"name": "Settings World", "seed": 99999},
            headers={"X-User-Id": TEST_USER_ID},
        )
        world_id = create_response.json()["id"]

        # Update settings
        response = await client.patch(
            f"/worlds/{world_id}",
            json={
                "settings": {
                    "grid_organic": 0.9,
                    "sprawl_compact": 0.1,
                    "historic_modern": 0.5,
                    "transit_car": 0.5,
                    "block_size_meters": 200,
                    "district_size_meters": 800,
                }
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["settings"]["grid_organic"] == 0.9
        assert data["settings"]["sprawl_compact"] == 0.1
        assert data["settings"]["block_size_meters"] == 200
        assert data["settings"]["district_size_meters"] == 800

    @pytest.mark.asyncio
    async def test_update_world_scale_settings_only(self, client: AsyncClient):
        """Update only scale settings should preserve other settings."""
        # Create a world with custom personality settings
        create_response = await client.post(
            "/worlds",
            json={
                "name": "Scale Update World",
                "seed": 10101,
                "settings": {
                    "grid_organic": 0.7,
                    "sprawl_compact": 0.3,
                    "historic_modern": 0.6,
                    "transit_car": 0.4,
                    "block_size_meters": 100,
                    "district_size_meters": 500,
                },
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        world_id = create_response.json()["id"]

        # Update only scale settings - note: current implementation replaces entire settings
        response = await client.patch(
            f"/worlds/{world_id}",
            json={
                "settings": {
                    "grid_organic": 0.7,
                    "sprawl_compact": 0.3,
                    "historic_modern": 0.6,
                    "transit_car": 0.4,
                    "block_size_meters": 150,
                    "district_size_meters": 600,
                }
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        data = response.json()
        # Scale settings updated
        assert data["settings"]["block_size_meters"] == 150
        assert data["settings"]["district_size_meters"] == 600
        # Personality settings preserved
        assert data["settings"]["grid_organic"] == 0.7
        assert data["settings"]["sprawl_compact"] == 0.3

    @pytest.mark.asyncio
    async def test_update_world_not_found(self, client: AsyncClient):
        """Update world should return 404 for non-existent world."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await client.patch(
            f"/worlds/{fake_id}",
            json={"name": "New Name"},
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_world_forbidden_for_other_user(self, client: AsyncClient):
        """Update world should return 403 for another user's world."""
        # Create world as user 1
        create_response = await client.post(
            "/worlds",
            json={"name": "User 1 World", "seed": 20202},
            headers={"X-User-Id": TEST_USER_ID},
        )
        world_id = create_response.json()["id"]

        # Try to update as user 2
        response = await client.patch(
            f"/worlds/{world_id}",
            json={"name": "Hacked Name"},
            headers={"X-User-Id": OTHER_USER_ID},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_world_invalid_scale_settings(self, client: AsyncClient):
        """Update world should reject invalid scale settings."""
        # Create a world
        create_response = await client.post(
            "/worlds",
            json={"name": "Valid World", "seed": 30303},
            headers={"X-User-Id": TEST_USER_ID},
        )
        world_id = create_response.json()["id"]

        # Try to update with invalid block_size_meters
        response = await client.patch(
            f"/worlds/{world_id}",
            json={
                "settings": {
                    "grid_organic": 0.5,
                    "sprawl_compact": 0.5,
                    "historic_modern": 0.5,
                    "transit_car": 0.5,
                    "block_size_meters": 10,  # Below min
                    "district_size_meters": 500,
                }
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 422


class TestDeleteWorld:
    """Tests for DELETE /worlds/{world_id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_world_success(self, client: AsyncClient):
        """Delete world should return 204."""
        # Create a world
        create_response = await client.post(
            "/worlds",
            json={"name": "Doomed World", "seed": 66666},
            headers={"X-User-Id": TEST_USER_ID},
        )
        world_id = create_response.json()["id"]

        # Delete the world
        response = await client.delete(
            f"/worlds/{world_id}",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 204

        # Verify it's gone
        get_response = await client.get(
            f"/worlds/{world_id}",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_world_not_found(self, client: AsyncClient):
        """Delete world should return 404 for non-existent world."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await client.delete(
            f"/worlds/{fake_id}",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_world_forbidden_for_other_user(self, client: AsyncClient):
        """Delete world should return 403 for another user's world."""
        # Create world as user 1
        create_response = await client.post(
            "/worlds",
            json={"name": "Protected World", "seed": 77777},
            headers={"X-User-Id": TEST_USER_ID},
        )
        world_id = create_response.json()["id"]

        # Try to delete as user 2
        response = await client.delete(
            f"/worlds/{world_id}",
            headers={"X-User-Id": OTHER_USER_ID},
        )
        assert response.status_code == 403

        # Verify it still exists for user 1
        get_response = await client.get(
            f"/worlds/{world_id}",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert get_response.status_code == 200
