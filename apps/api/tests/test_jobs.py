"""Tests for job endpoints."""

from uuid import uuid4

import pytest
from city_api.main import app
from city_api.repositories import job_repository
from city_api.schemas import JobStatus
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_jobs():
    """Clear all jobs before each test."""
    job_repository._jobs.clear()
    yield
    job_repository._jobs.clear()


class TestCreateJob:
    """Tests for POST /jobs."""

    def test_create_job_success(self, client):
        """Successfully create a job."""
        user_id = uuid4()

        response = client.post(
            "/jobs",
            headers={"X-User-ID": str(user_id)},
            json={"type": "terrain_generation"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "terrain_generation"
        assert data["status"] == "pending"
        assert data["user_id"] == str(user_id)
        assert "id" in data
        assert "created_at" in data

    def test_create_job_with_tile_id(self, client):
        """Create a job with a target tile."""
        user_id = uuid4()
        tile_id = uuid4()

        response = client.post(
            "/jobs",
            headers={"X-User-ID": str(user_id)},
            json={
                "type": "growth_simulation",
                "tile_id": str(tile_id),
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["tile_id"] == str(tile_id)

    def test_create_job_with_params(self, client):
        """Create a job with custom parameters."""
        user_id = uuid4()

        response = client.post(
            "/jobs",
            headers={"X-User-ID": str(user_id)},
            json={
                "type": "export_png",
                "params": {"resolution": 1920, "format": "png"},
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["params"]["resolution"] == 1920
        assert data["params"]["format"] == "png"

    def test_create_job_invalid_type(self, client):
        """Fail to create job with invalid type."""
        user_id = uuid4()

        response = client.post(
            "/jobs",
            headers={"X-User-ID": str(user_id)},
            json={"type": "invalid_type"},
        )

        assert response.status_code == 422


class TestListJobs:
    """Tests for GET /jobs."""

    def test_list_jobs_empty(self, client):
        """List jobs when none exist."""
        user_id = uuid4()

        response = client.get(
            "/jobs",
            headers={"X-User-ID": str(user_id)},
        )

        assert response.status_code == 200
        assert response.json() == []

    def test_list_jobs_returns_user_jobs(self, client):
        """List jobs returns only current user's jobs."""
        user_id = uuid4()

        # Create some jobs
        client.post(
            "/jobs",
            headers={"X-User-ID": str(user_id)},
            json={"type": "terrain_generation"},
        )
        client.post(
            "/jobs",
            headers={"X-User-ID": str(user_id)},
            json={"type": "export_png"},
        )

        response = client.get(
            "/jobs",
            headers={"X-User-ID": str(user_id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_list_jobs_excludes_other_users(self, client):
        """List jobs excludes other users' jobs."""
        user1 = uuid4()
        user2 = uuid4()

        # User 1 creates a job
        client.post(
            "/jobs",
            headers={"X-User-ID": str(user1)},
            json={"type": "terrain_generation"},
        )

        # User 2 lists jobs
        response = client.get(
            "/jobs",
            headers={"X-User-ID": str(user2)},
        )

        assert response.status_code == 200
        assert response.json() == []

    def test_list_jobs_filter_by_tile(self, client):
        """Filter jobs by tile ID."""
        user_id = uuid4()
        tile_id = uuid4()

        # Create jobs with and without tile
        client.post(
            "/jobs",
            headers={"X-User-ID": str(user_id)},
            json={"type": "terrain_generation", "tile_id": str(tile_id)},
        )
        client.post(
            "/jobs",
            headers={"X-User-ID": str(user_id)},
            json={"type": "export_png"},
        )

        response = client.get(
            f"/jobs?tile_id={tile_id}",
            headers={"X-User-ID": str(user_id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["tile_id"] == str(tile_id)


class TestGetJob:
    """Tests for GET /jobs/{job_id}."""

    def test_get_job_success(self, client):
        """Get a job by ID."""
        user_id = uuid4()

        # Create a job
        create_response = client.post(
            "/jobs",
            headers={"X-User-ID": str(user_id)},
            json={"type": "terrain_generation"},
        )
        job_id = create_response.json()["id"]

        # Get the job
        response = client.get(
            f"/jobs/{job_id}",
            headers={"X-User-ID": str(user_id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == job_id

    def test_get_job_not_found(self, client):
        """Get a non-existent job returns 404."""
        user_id = uuid4()
        job_id = uuid4()

        response = client.get(
            f"/jobs/{job_id}",
            headers={"X-User-ID": str(user_id)},
        )

        assert response.status_code == 404

    def test_get_job_wrong_user(self, client):
        """Cannot access another user's job."""
        user1 = uuid4()
        user2 = uuid4()

        # User 1 creates a job
        create_response = client.post(
            "/jobs",
            headers={"X-User-ID": str(user1)},
            json={"type": "terrain_generation"},
        )
        job_id = create_response.json()["id"]

        # User 2 tries to access it
        response = client.get(
            f"/jobs/{job_id}",
            headers={"X-User-ID": str(user2)},
        )

        assert response.status_code == 403
        assert "another user" in response.json()["detail"]


class TestCancelJob:
    """Tests for POST /jobs/{job_id}/cancel."""

    def test_cancel_job_success(self, client):
        """Cancel a pending job."""
        user_id = uuid4()

        # Create a job
        create_response = client.post(
            "/jobs",
            headers={"X-User-ID": str(user_id)},
            json={"type": "terrain_generation"},
        )
        job_id = create_response.json()["id"]

        # Cancel the job
        response = client.post(
            f"/jobs/{job_id}/cancel",
            headers={"X-User-ID": str(user_id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cancelled"

    def test_cancel_job_not_found(self, client):
        """Cancel a non-existent job returns 404."""
        user_id = uuid4()
        job_id = uuid4()

        response = client.post(
            f"/jobs/{job_id}/cancel",
            headers={"X-User-ID": str(user_id)},
        )

        assert response.status_code == 404

    def test_cancel_job_wrong_user(self, client):
        """Cannot cancel another user's job."""
        user1 = uuid4()
        user2 = uuid4()

        # User 1 creates a job
        create_response = client.post(
            "/jobs",
            headers={"X-User-ID": str(user1)},
            json={"type": "terrain_generation"},
        )
        job_id = create_response.json()["id"]

        # User 2 tries to cancel
        response = client.post(
            f"/jobs/{job_id}/cancel",
            headers={"X-User-ID": str(user2)},
        )

        assert response.status_code == 403

    def test_cancel_running_job_fails(self, client):
        """Cannot cancel a running job."""
        user_id = uuid4()

        # Create a job
        create_response = client.post(
            "/jobs",
            headers={"X-User-ID": str(user_id)},
            json={"type": "terrain_generation"},
        )
        job_id = create_response.json()["id"]

        # Manually set it to running
        from uuid import UUID

        job_repository.update_status(UUID(job_id), JobStatus.RUNNING)

        # Try to cancel
        response = client.post(
            f"/jobs/{job_id}/cancel",
            headers={"X-User-ID": str(user_id)},
        )

        assert response.status_code == 409
