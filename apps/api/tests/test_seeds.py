"""Tests for placed seeds endpoints."""

import pytest
from httpx import AsyncClient

# Test user ID for the X-User-Id header
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000002"

# The test world created by conftest.py
TEST_WORLD_ID = "00000000-0000-0000-0000-000000000010"


class TestCreateSeed:
    """Tests for POST /worlds/{world_id}/seeds endpoint."""

    @pytest.mark.asyncio
    async def test_create_seed_success(self, client: AsyncClient):
        """Create seed should return 201 with seed data."""
        response = await client.post(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            json={
                "seed_type_id": "residential",
                "position": {"x": 100.5, "y": 200.5},
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["seed_type_id"] == "residential"
        assert data["position"]["x"] == 100.5
        assert data["position"]["y"] == 200.5
        assert data["world_id"] == TEST_WORLD_ID
        assert "id" in data
        assert "placed_at" in data

    @pytest.mark.asyncio
    async def test_create_seed_in_nonexistent_world(self, client: AsyncClient):
        """Create seed in nonexistent world should return 404."""
        fake_world_id = "00000000-0000-0000-0000-000000000099"
        response = await client.post(
            f"/worlds/{fake_world_id}/seeds",
            json={
                "seed_type_id": "downtown",
                "position": {"x": 50, "y": 50},
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_seed_in_other_users_world(self, client: AsyncClient):
        """Create seed in another user's world should return 403."""
        response = await client.post(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            json={
                "seed_type_id": "park",
                "position": {"x": 75, "y": 75},
            },
            headers={"X-User-Id": OTHER_USER_ID},
        )
        assert response.status_code == 403


class TestCreateSeedsBulk:
    """Tests for POST /worlds/{world_id}/seeds/bulk endpoint."""

    @pytest.mark.asyncio
    async def test_create_seeds_bulk_success(self, client: AsyncClient):
        """Bulk create seeds should return 201 with all seeds."""
        response = await client.post(
            f"/worlds/{TEST_WORLD_ID}/seeds/bulk",
            json={
                "seeds": [
                    {"seed_type_id": "residential", "position": {"x": 10, "y": 20}},
                    {"seed_type_id": "downtown", "position": {"x": 30, "y": 40}},
                    {"seed_type_id": "park", "position": {"x": 50, "y": 60}},
                ]
            },
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 3
        assert data[0]["seed_type_id"] == "residential"
        assert data[1]["seed_type_id"] == "downtown"
        assert data[2]["seed_type_id"] == "park"

    @pytest.mark.asyncio
    async def test_create_seeds_bulk_empty_list(self, client: AsyncClient):
        """Bulk create with empty list should return empty array."""
        response = await client.post(
            f"/worlds/{TEST_WORLD_ID}/seeds/bulk",
            json={"seeds": []},
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 201
        assert response.json() == []


class TestListSeeds:
    """Tests for GET /worlds/{world_id}/seeds endpoint."""

    @pytest.mark.asyncio
    async def test_list_seeds_empty(self, client: AsyncClient):
        """List seeds on world with no seeds should return empty array."""
        response = await client.get(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_seeds_with_seeds(self, client: AsyncClient):
        """List seeds should return all seeds in the world."""
        # Create some seeds first
        await client.post(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            json={"seed_type_id": "hospital", "position": {"x": 100, "y": 100}},
            headers={"X-User-Id": TEST_USER_ID},
        )
        await client.post(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            json={"seed_type_id": "university", "position": {"x": 200, "y": 200}},
            headers={"X-User-Id": TEST_USER_ID},
        )

        # List seeds
        response = await client.get(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        seed_types = [s["seed_type_id"] for s in data]
        assert "hospital" in seed_types
        assert "university" in seed_types

    @pytest.mark.asyncio
    async def test_list_seeds_forbidden_for_other_user(self, client: AsyncClient):
        """List seeds on another user's world should return 403."""
        response = await client.get(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            headers={"X-User-Id": OTHER_USER_ID},
        )
        assert response.status_code == 403


class TestDeleteSeed:
    """Tests for DELETE /seeds/{seed_id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_seed_success(self, client: AsyncClient):
        """Delete seed should return 204."""
        # Create a seed
        create_response = await client.post(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            json={"seed_type_id": "airport", "position": {"x": 500, "y": 500}},
            headers={"X-User-Id": TEST_USER_ID},
        )
        seed_id = create_response.json()["id"]

        # Delete it
        response = await client.delete(
            f"/seeds/{seed_id}",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 204

        # Verify it's gone
        list_response = await client.get(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            headers={"X-User-Id": TEST_USER_ID},
        )
        seed_ids = [s["id"] for s in list_response.json()]
        assert seed_id not in seed_ids

    @pytest.mark.asyncio
    async def test_delete_seed_not_found(self, client: AsyncClient):
        """Delete nonexistent seed should return 404."""
        fake_seed_id = "00000000-0000-0000-0000-000000000099"
        response = await client.delete(
            f"/seeds/{fake_seed_id}",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_seed_forbidden_for_other_user(self, client: AsyncClient):
        """Delete seed in another user's world should return 403."""
        # Create a seed as user 1
        create_response = await client.post(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            json={"seed_type_id": "subway", "position": {"x": 300, "y": 300}},
            headers={"X-User-Id": TEST_USER_ID},
        )
        seed_id = create_response.json()["id"]

        # Try to delete as user 2
        response = await client.delete(
            f"/seeds/{seed_id}",
            headers={"X-User-Id": OTHER_USER_ID},
        )
        assert response.status_code == 403


class TestDeleteAllSeeds:
    """Tests for DELETE /worlds/{world_id}/seeds endpoint."""

    @pytest.mark.asyncio
    async def test_delete_all_seeds_success(self, client: AsyncClient):
        """Delete all seeds should return 204 and remove all seeds."""
        # Create some seeds
        await client.post(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            json={"seed_type_id": "train_station", "position": {"x": 1, "y": 1}},
            headers={"X-User-Id": TEST_USER_ID},
        )
        await client.post(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            json={"seed_type_id": "industrial", "position": {"x": 2, "y": 2}},
            headers={"X-User-Id": TEST_USER_ID},
        )

        # Verify seeds exist
        list_response = await client.get(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert len(list_response.json()) >= 2

        # Delete all seeds
        response = await client.delete(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert response.status_code == 204

        # Verify all seeds are gone
        list_response = await client.get(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            headers={"X-User-Id": TEST_USER_ID},
        )
        assert list_response.json() == []

    @pytest.mark.asyncio
    async def test_delete_all_seeds_forbidden_for_other_user(self, client: AsyncClient):
        """Delete all seeds in another user's world should return 403."""
        response = await client.delete(
            f"/worlds/{TEST_WORLD_ID}/seeds",
            headers={"X-User-Id": OTHER_USER_ID},
        )
        assert response.status_code == 403
