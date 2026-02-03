"""Tests for tile locking endpoints."""

from uuid import uuid4

import pytest

# Fixed test user IDs matching those created in conftest.py
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000002"


class TestAcquireLock:
    """Tests for POST /tiles/{tile_id}/lock."""

    @pytest.mark.asyncio
    async def test_acquire_lock_success(self, client):
        """Successfully acquire a lock on an unlocked tile."""
        tile_id = uuid4()
        user_id = TEST_USER_ID

        response = await client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user_id},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["tile_id"] == str(tile_id)
        assert data["user_id"] == user_id
        assert "locked_at" in data
        assert "expires_at" in data

    @pytest.mark.asyncio
    async def test_acquire_lock_with_custom_duration(self, client):
        """Acquire a lock with custom duration."""
        tile_id = uuid4()
        user_id = TEST_USER_ID

        response = await client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user_id},
            json={"duration_seconds": 600},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_acquire_lock_conflict(self, client):
        """Fail to acquire a lock already held by another user."""
        tile_id = uuid4()
        user1 = TEST_USER_ID
        user2 = OTHER_USER_ID

        # User 1 acquires lock
        await client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user1},
        )

        # User 2 tries to acquire same lock
        response = await client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user2},
        )

        assert response.status_code == 409
        data = response.json()
        assert "locked by another user" in data["detail"]["message"].lower()

    @pytest.mark.asyncio
    async def test_acquire_lock_extend_own(self, client):
        """Acquiring a lock you already hold extends it."""
        tile_id = uuid4()
        user_id = TEST_USER_ID

        # Acquire initial lock
        await client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user_id},
        )

        # Acquire again (should extend)
        response2 = await client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user_id},
        )

        assert response2.status_code == 200


class TestReleaseLock:
    """Tests for DELETE /tiles/{tile_id}/lock."""

    @pytest.mark.asyncio
    async def test_release_lock_success(self, client):
        """Successfully release a lock you hold."""
        tile_id = uuid4()
        user_id = TEST_USER_ID

        # Acquire lock
        await client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user_id},
        )

        # Release lock
        response = await client.delete(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user_id},
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_release_lock_not_found(self, client):
        """Fail to release a lock that doesn't exist."""
        tile_id = uuid4()
        user_id = TEST_USER_ID

        response = await client.delete(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user_id},
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_release_lock_forbidden(self, client):
        """Fail to release a lock held by another user."""
        tile_id = uuid4()
        user1 = TEST_USER_ID
        user2 = OTHER_USER_ID

        # User 1 acquires lock
        await client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user1},
        )

        # User 2 tries to release
        response = await client.delete(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user2},
        )

        assert response.status_code == 403


class TestGetLock:
    """Tests for GET /tiles/{tile_id}/lock."""

    @pytest.mark.asyncio
    async def test_get_lock_exists(self, client):
        """Get details of an active lock."""
        tile_id = uuid4()
        user_id = TEST_USER_ID

        # Acquire lock
        await client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user_id},
        )

        # Get lock
        response = await client.get(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user_id},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["tile_id"] == str(tile_id)
        assert data["user_id"] == user_id

    @pytest.mark.asyncio
    async def test_get_lock_not_exists(self, client):
        """Get lock status for unlocked tile returns null."""
        tile_id = uuid4()
        user_id = TEST_USER_ID

        response = await client.get(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user_id},
        )

        assert response.status_code == 200
        assert response.json() is None


class TestHeartbeatLock:
    """Tests for POST /tiles/{tile_id}/lock/heartbeat."""

    @pytest.mark.asyncio
    async def test_heartbeat_success(self, client):
        """Successfully extend an active lock."""
        tile_id = uuid4()
        user_id = TEST_USER_ID

        # Acquire lock
        await client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user_id},
        )

        # Heartbeat
        response = await client.post(
            f"/tiles/{tile_id}/lock/heartbeat",
            headers={"X-User-ID": user_id},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_heartbeat_not_found(self, client):
        """Fail to heartbeat a non-existent lock."""
        tile_id = uuid4()
        user_id = TEST_USER_ID

        response = await client.post(
            f"/tiles/{tile_id}/lock/heartbeat",
            headers={"X-User-ID": user_id},
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_heartbeat_forbidden(self, client):
        """Fail to heartbeat a lock held by another user."""
        tile_id = uuid4()
        user1 = TEST_USER_ID
        user2 = OTHER_USER_ID

        # User 1 acquires lock
        await client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": user1},
        )

        # User 2 tries to heartbeat
        response = await client.post(
            f"/tiles/{tile_id}/lock/heartbeat",
            headers={"X-User-ID": user2},
        )

        assert response.status_code == 403
