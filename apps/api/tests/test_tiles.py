"""Tests for tile CRUD endpoints."""

import pytest
from httpx import AsyncClient

# Test user IDs for the X-User-Id header
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000002"


@pytest.fixture
async def world_id(client: AsyncClient) -> str:
    """Create a test world and return its ID."""
    response = await client.post(
        "/worlds",
        json={"name": "Test World", "seed": 11111},  # Use explicit seed to avoid int32 overflow
        headers={"X-User-Id": TEST_USER_ID},
    )
    return response.json()["id"]


@pytest.fixture
async def other_user_world_id(client: AsyncClient) -> str:
    """Create a world owned by another user."""
    response = await client.post(
        "/worlds",
        json={"name": "Other User World", "seed": 22222},  # Use explicit seed
        headers={"X-User-Id": OTHER_USER_ID},
    )
    return response.json()["id"]


class TestGetOrCreateTile:
    """Tests for POST /worlds/{world_id}/tiles endpoint."""

    @pytest.mark.asyncio
    async def test_create_tile_success(self, client: AsyncClient, world_id: str):
        """Create a new tile at specified coordinates."""
        response = await client.post(
            f"/worlds/{world_id}/tiles?tx=0&ty=0",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["world_id"] == world_id
        assert data["tx"] == 0
        assert data["ty"] == 0
        assert "id" in data
        assert "terrain_data" in data
        assert "features" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_get_existing_tile(self, client: AsyncClient, world_id: str):
        """Get existing tile when called with same coordinates."""
        # Create a tile
        response1 = await client.post(
            f"/worlds/{world_id}/tiles?tx=5&ty=10",
            headers={"X-User-Id": TEST_USER_ID},
        )
        tile_id = response1.json()["id"]

        # Call again with same coordinates
        response2 = await client.post(
            f"/worlds/{world_id}/tiles?tx=5&ty=10",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response2.status_code == 201
        assert response2.json()["id"] == tile_id

    @pytest.mark.asyncio
    async def test_create_tile_negative_coords(self, client: AsyncClient, world_id: str):
        """Create tiles at negative coordinates."""
        response = await client.post(
            f"/worlds/{world_id}/tiles?tx=-5&ty=-10",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["tx"] == -5
        assert data["ty"] == -10

    @pytest.mark.asyncio
    async def test_create_tile_world_not_found(self, client: AsyncClient):
        """Return 404 for non-existent world."""
        fake_world_id = "00000000-0000-0000-0000-000000000000"
        response = await client.post(
            f"/worlds/{fake_world_id}/tiles?tx=0&ty=0",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_tile_forbidden_for_other_user(
        self, client: AsyncClient, other_user_world_id: str
    ):
        """Return 403 when trying to create tile in another user's world."""
        response = await client.post(
            f"/worlds/{other_user_world_id}/tiles?tx=0&ty=0",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 403


class TestListTiles:
    """Tests for GET /worlds/{world_id}/tiles endpoint."""

    @pytest.mark.asyncio
    async def test_list_tiles_empty(self, client: AsyncClient, world_id: str):
        """List tiles when none exist."""
        response = await client.get(
            f"/worlds/{world_id}/tiles",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_tiles_returns_all(self, client: AsyncClient, world_id: str):
        """List all tiles in a world."""
        # Create some tiles
        for x, y in [(0, 0), (1, 0), (0, 1)]:
            await client.post(
                f"/worlds/{world_id}/tiles?tx={x}&ty={y}",
                headers={"X-User-Id": TEST_USER_ID},
            )

        response = await client.get(
            f"/worlds/{world_id}/tiles",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    @pytest.mark.asyncio
    async def test_list_tiles_filter_by_exact_coords(self, client: AsyncClient, world_id: str):
        """Filter tiles by exact coordinates."""
        # Create multiple tiles
        await client.post(
            f"/worlds/{world_id}/tiles?tx=0&ty=0",
            headers={"X-User-Id": TEST_USER_ID},
        )
        await client.post(
            f"/worlds/{world_id}/tiles?tx=1&ty=1",
            headers={"X-User-Id": TEST_USER_ID},
        )

        response = await client.get(
            f"/worlds/{world_id}/tiles?tx=0&ty=0",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["tx"] == 0
        assert data[0]["ty"] == 0

    @pytest.mark.asyncio
    async def test_list_tiles_filter_by_bbox(self, client: AsyncClient, world_id: str):
        """Filter tiles by bounding box."""
        # Create tiles at various coordinates
        for x, y in [(0, 0), (5, 5), (10, 10), (15, 15)]:
            await client.post(
                f"/worlds/{world_id}/tiles?tx={x}&ty={y}",
                headers={"X-User-Id": TEST_USER_ID},
            )

        response = await client.get(
            f"/worlds/{world_id}/tiles?min_tx=0&max_tx=10&min_ty=0&max_ty=10",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3  # (0,0), (5,5), (10,10) - but not (15,15)

    @pytest.mark.asyncio
    async def test_list_tiles_world_not_found(self, client: AsyncClient):
        """Return 404 for non-existent world."""
        fake_world_id = "00000000-0000-0000-0000-000000000000"
        response = await client.get(
            f"/worlds/{fake_world_id}/tiles",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_tiles_forbidden_for_other_user(
        self, client: AsyncClient, other_user_world_id: str
    ):
        """Return 403 when listing tiles in another user's world."""
        response = await client.get(
            f"/worlds/{other_user_world_id}/tiles",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 403


class TestGetTile:
    """Tests for GET /tiles/{tile_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_tile_success(self, client: AsyncClient, world_id: str):
        """Get a tile by ID."""
        # Create a tile
        create_response = await client.post(
            f"/worlds/{world_id}/tiles?tx=0&ty=0",
            headers={"X-User-Id": TEST_USER_ID},
        )
        tile_id = create_response.json()["id"]

        # Get the tile
        response = await client.get(
            f"/tiles/{tile_id}",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == tile_id
        assert data["tx"] == 0
        assert data["ty"] == 0

    @pytest.mark.asyncio
    async def test_get_tile_not_found(self, client: AsyncClient):
        """Return 404 for non-existent tile."""
        fake_tile_id = "00000000-0000-0000-0000-000000000000"
        response = await client.get(
            f"/tiles/{fake_tile_id}",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_tile_forbidden_for_other_user(
        self, client: AsyncClient, other_user_world_id: str
    ):
        """Return 403 when getting tile from another user's world."""
        # Create tile as other user
        create_response = await client.post(
            f"/worlds/{other_user_world_id}/tiles?tx=0&ty=0",
            headers={"X-User-Id": OTHER_USER_ID},
        )
        tile_id = create_response.json()["id"]

        # Try to get as test user
        response = await client.get(
            f"/tiles/{tile_id}",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 403


class TestUpdateTile:
    """Tests for PATCH /tiles/{tile_id} endpoint."""

    @pytest.mark.asyncio
    async def test_update_tile_requires_lock(self, client: AsyncClient, world_id: str):
        """Update tile without lock should return 409 Conflict."""
        # Create a tile
        create_response = await client.post(
            f"/worlds/{world_id}/tiles?tx=0&ty=0",
            headers={"X-User-Id": TEST_USER_ID},
        )
        tile_id = create_response.json()["id"]

        # Try to update without acquiring a lock
        response = await client.patch(
            f"/tiles/{tile_id}",
            json={"terrain_data": {"elevation": [[1.0]]}},
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 409
        assert "locked" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_update_tile_with_other_users_lock(self, client: AsyncClient, world_id: str):
        """Update tile with another user's lock should return 409."""
        # Create a tile
        create_response = await client.post(
            f"/worlds/{world_id}/tiles?tx=0&ty=0",
            headers={"X-User-Id": TEST_USER_ID},
        )
        tile_id = create_response.json()["id"]

        # Another user acquires the lock
        await client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-Id": OTHER_USER_ID},
        )

        # Try to update as test user (doesn't hold the lock)
        response = await client.patch(
            f"/tiles/{tile_id}",
            json={"terrain_data": {"elevation": [[1.0]]}},
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_update_tile_terrain_data(self, client: AsyncClient, world_id: str):
        """Update tile terrain data with valid lock."""
        # Create a tile
        create_response = await client.post(
            f"/worlds/{world_id}/tiles?tx=0&ty=0",
            headers={"X-User-Id": TEST_USER_ID},
        )
        tile_id = create_response.json()["id"]

        # Acquire a lock
        await client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-Id": TEST_USER_ID},
        )

        # Update terrain data
        response = await client.patch(
            f"/tiles/{tile_id}",
            json={
                "terrain_data": {
                    "elevation": [[1.0, 2.0], [3.0, 4.0]],
                    "water_bodies": [{"type": "lake", "area": 100}],
                    "vegetation": [],
                }
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["terrain_data"]["elevation"] == [[1.0, 2.0], [3.0, 4.0]]
        assert len(data["terrain_data"]["water_bodies"]) == 1

    @pytest.mark.asyncio
    async def test_update_tile_features(self, client: AsyncClient, world_id: str):
        """Update tile features with valid lock."""
        # Create a tile
        create_response = await client.post(
            f"/worlds/{world_id}/tiles?tx=0&ty=0",
            headers={"X-User-Id": TEST_USER_ID},
        )
        tile_id = create_response.json()["id"]

        # Acquire a lock
        await client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-Id": TEST_USER_ID},
        )

        # Update features
        response = await client.patch(
            f"/tiles/{tile_id}",
            json={
                "features": {
                    "roads": [{"type": "highway", "points": [[0, 0], [10, 10]]}],
                    "buildings": [],
                    "pois": [{"name": "Park", "coords": [5, 5]}],
                }
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["features"]["roads"]) == 1
        assert len(data["features"]["pois"]) == 1

    @pytest.mark.asyncio
    async def test_update_tile_not_found(self, client: AsyncClient):
        """Return 404 for non-existent tile."""
        fake_tile_id = "00000000-0000-0000-0000-000000000000"
        response = await client.patch(
            f"/tiles/{fake_tile_id}",
            json={"terrain_data": {"elevation": []}},
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_tile_forbidden_for_other_user(
        self, client: AsyncClient, other_user_world_id: str
    ):
        """Return 403 when updating tile in another user's world."""
        # Create tile as other user
        create_response = await client.post(
            f"/worlds/{other_user_world_id}/tiles?tx=0&ty=0",
            headers={"X-User-Id": OTHER_USER_ID},
        )
        tile_id = create_response.json()["id"]

        # Other user acquires lock on their tile
        await client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-Id": OTHER_USER_ID},
        )

        # Try to update as test user
        # (world access check runs before lock check)
        response = await client.patch(
            f"/tiles/{tile_id}",
            json={"terrain_data": {"elevation": []}},
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 403
