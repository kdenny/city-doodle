"""Tests for tile locking endpoints."""

from uuid import uuid4

import pytest
from city_api.main import app
from city_api.repositories import lock_repository
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_locks():
    """Clear all locks before each test."""
    lock_repository._locks.clear()
    yield
    lock_repository._locks.clear()


class TestAcquireLock:
    """Tests for POST /tiles/{tile_id}/lock."""

    def test_acquire_lock_success(self, client):
        """Successfully acquire a lock on an unlocked tile."""
        tile_id = uuid4()
        user_id = uuid4()

        response = client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user_id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["tile_id"] == str(tile_id)
        assert data["user_id"] == str(user_id)
        assert "locked_at" in data
        assert "expires_at" in data

    def test_acquire_lock_with_custom_duration(self, client):
        """Acquire a lock with custom duration."""
        tile_id = uuid4()
        user_id = uuid4()

        response = client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user_id)},
            json={"duration_seconds": 600},
        )

        assert response.status_code == 200

    def test_acquire_lock_conflict(self, client):
        """Fail to acquire a lock already held by another user."""
        tile_id = uuid4()
        user1 = uuid4()
        user2 = uuid4()

        # User 1 acquires lock
        client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user1)},
        )

        # User 2 tries to acquire same lock
        response = client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user2)},
        )

        assert response.status_code == 409
        data = response.json()
        assert "locked by another user" in data["detail"]["message"].lower()

    def test_acquire_lock_extend_own(self, client):
        """Acquiring a lock you already hold extends it."""
        tile_id = uuid4()
        user_id = uuid4()

        # Acquire initial lock
        client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user_id)},
        )

        # Acquire again (should extend)
        response2 = client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user_id)},
        )

        assert response2.status_code == 200


class TestReleaseLock:
    """Tests for DELETE /tiles/{tile_id}/lock."""

    def test_release_lock_success(self, client):
        """Successfully release a lock you hold."""
        tile_id = uuid4()
        user_id = uuid4()

        # Acquire lock
        client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user_id)},
        )

        # Release lock
        response = client.delete(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user_id)},
        )

        assert response.status_code == 204

    def test_release_lock_not_found(self, client):
        """Fail to release a lock that doesn't exist."""
        tile_id = uuid4()
        user_id = uuid4()

        response = client.delete(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user_id)},
        )

        assert response.status_code == 404

    def test_release_lock_forbidden(self, client):
        """Fail to release a lock held by another user."""
        tile_id = uuid4()
        user1 = uuid4()
        user2 = uuid4()

        # User 1 acquires lock
        client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user1)},
        )

        # User 2 tries to release
        response = client.delete(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user2)},
        )

        assert response.status_code == 403


class TestGetLock:
    """Tests for GET /tiles/{tile_id}/lock."""

    def test_get_lock_exists(self, client):
        """Get details of an active lock."""
        tile_id = uuid4()
        user_id = uuid4()

        # Acquire lock
        client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user_id)},
        )

        # Get lock
        response = client.get(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user_id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["tile_id"] == str(tile_id)
        assert data["user_id"] == str(user_id)

    def test_get_lock_not_exists(self, client):
        """Get lock status for unlocked tile returns null."""
        tile_id = uuid4()
        user_id = uuid4()

        response = client.get(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user_id)},
        )

        assert response.status_code == 200
        assert response.json() is None


class TestHeartbeatLock:
    """Tests for POST /tiles/{tile_id}/lock/heartbeat."""

    def test_heartbeat_success(self, client):
        """Successfully extend an active lock."""
        tile_id = uuid4()
        user_id = uuid4()

        # Acquire lock
        client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user_id)},
        )

        # Heartbeat
        response = client.post(
            f"/tiles/{tile_id}/lock/heartbeat",
            headers={"X-User-ID": str(user_id)},
        )

        assert response.status_code == 200

    def test_heartbeat_not_found(self, client):
        """Fail to heartbeat a non-existent lock."""
        tile_id = uuid4()
        user_id = uuid4()

        response = client.post(
            f"/tiles/{tile_id}/lock/heartbeat",
            headers={"X-User-ID": str(user_id)},
        )

        assert response.status_code == 404

    def test_heartbeat_forbidden(self, client):
        """Fail to heartbeat a lock held by another user."""
        tile_id = uuid4()
        user1 = uuid4()
        user2 = uuid4()

        # User 1 acquires lock
        client.post(
            f"/tiles/{tile_id}/lock",
            headers={"X-User-ID": str(user1)},
        )

        # User 2 tries to heartbeat
        response = client.post(
            f"/tiles/{tile_id}/lock/heartbeat",
            headers={"X-User-ID": str(user2)},
        )

        assert response.status_code == 403
