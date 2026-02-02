"""Tests for world CRUD endpoints."""

import pytest
from httpx import AsyncClient

# Test user ID for the X-User-Id header
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000002"


class TestCreateWorld:
    """Tests for POST /worlds endpoint."""

    @pytest.mark.asyncio
    async def test_create_world_success(self, client: AsyncClient):
        """Create world should return 201 with world data."""
        response = await client.post(
            "/worlds",
            json={"name": "Test World"},
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
                "settings": {
                    "grid_size": 5,
                    "terrain_type": "coastal",
                },
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["settings"]["grid_size"] == 5
        assert data["settings"]["terrain_type"] == "coastal"


class TestListWorlds:
    """Tests for GET /worlds endpoint."""

    @pytest.mark.asyncio
    async def test_list_worlds_empty(self, client: AsyncClient):
        """List worlds should return empty list when no worlds exist."""
        response = await client.get(
            "/worlds",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_worlds_returns_user_worlds(self, client: AsyncClient):
        """List worlds should return only the user's worlds."""
        # Create a world
        await client.post(
            "/worlds",
            json={"name": "My World"},
            headers={"X-User-Id": TEST_USER_ID},
        )

        # List worlds
        response = await client.get(
            "/worlds",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "My World"

    @pytest.mark.asyncio
    async def test_list_worlds_excludes_other_users(self, client: AsyncClient):
        """List worlds should not include other users' worlds."""
        # Create world as user 1
        await client.post(
            "/worlds",
            json={"name": "User 1 World"},
            headers={"X-User-Id": TEST_USER_ID},
        )

        # Create world as user 2
        await client.post(
            "/worlds",
            json={"name": "User 2 World"},
            headers={"X-User-Id": OTHER_USER_ID},
        )

        # List as user 1
        response = await client.get(
            "/worlds",
            headers={"X-User-Id": TEST_USER_ID},
        )
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "User 1 World"


class TestGetWorld:
    """Tests for GET /worlds/{world_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_world_success(self, client: AsyncClient):
        """Get world should return the world data."""
        # Create a world
        create_response = await client.post(
            "/worlds",
            json={"name": "Test World"},
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
            json={"name": "Private World"},
            headers={"X-User-Id": TEST_USER_ID},
        )
        world_id = create_response.json()["id"]

        # Try to get as user 2
        response = await client.get(
            f"/worlds/{world_id}",
            headers={"X-User-Id": OTHER_USER_ID},
        )
        assert response.status_code == 403


class TestDeleteWorld:
    """Tests for DELETE /worlds/{world_id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_world_success(self, client: AsyncClient):
        """Delete world should return 204."""
        # Create a world
        create_response = await client.post(
            "/worlds",
            json={"name": "Doomed World"},
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
            json={"name": "Protected World"},
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
