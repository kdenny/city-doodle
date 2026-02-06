"""Tests for worker module."""

import asyncio
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from city_worker.config import Settings
from city_worker.models import JobStatus, JobType
from city_worker.runner import JobRunner


def test_job_status_values():
    """Test JobStatus enum has expected values."""
    assert JobStatus.PENDING.value == "pending"
    assert JobStatus.RUNNING.value == "running"
    assert JobStatus.CLAIMED.value == "claimed"
    assert JobStatus.COMPLETED.value == "completed"
    assert JobStatus.FAILED.value == "failed"
    assert JobStatus.CANCELLED.value == "cancelled"


def test_job_type_values():
    """Test JobType enum has expected values."""
    assert JobType.TERRAIN_GENERATION.value == "terrain_generation"
    assert JobType.SEED_PLACEMENT.value == "seed_placement"
    assert JobType.GROWTH_SIMULATION.value == "growth_simulation"
    assert JobType.VMT_CALCULATION.value == "vmt_calculation"
    assert JobType.CITY_GROWTH.value == "city_growth"
    assert JobType.EXPORT_PNG.value == "export_png"
    assert JobType.EXPORT_GIF.value == "export_gif"


def test_settings_defaults():
    """Test Settings has sensible defaults."""
    settings = Settings()
    assert settings.poll_interval_seconds > 0
    assert settings.max_concurrent_jobs > 0
    assert settings.job_timeout_seconds > 0


def test_job_runner_initialization():
    """Test JobRunner initializes correctly."""
    runner = JobRunner()
    assert runner._shutdown is False
    assert len(runner._active_jobs) == 0


def test_job_runner_shutdown_handler():
    """Test JobRunner handles shutdown signal."""
    runner = JobRunner()
    assert runner._shutdown is False

    runner._handle_shutdown()

    assert runner._shutdown is True


@pytest.mark.asyncio
async def test_job_handler_terrain_generation():
    """Test terrain generation handler returns expected result."""
    runner = JobRunner()

    # Mock the database save to avoid actual DB calls
    with patch.object(runner, "_save_terrain_tiles", new_callable=AsyncMock):
        result = await runner._handle_terrain_generation(
            {
                "world_id": str(uuid4()),
                "world_seed": 42,
                "center_tx": 0,
                "center_ty": 0,
            }
        )

    assert "status" in result
    assert result["status"] == "generated"
    assert result["tiles_generated"] == 9


@pytest.mark.asyncio
async def test_job_handler_terrain_generation_missing_params():
    """Test terrain generation handler validates required params."""
    runner = JobRunner()

    with pytest.raises(ValueError, match="world_id is required"):
        await runner._handle_terrain_generation({})

    with pytest.raises(ValueError, match="world_seed is required"):
        await runner._handle_terrain_generation({"world_id": str(uuid4())})


@pytest.mark.asyncio
async def test_job_handler_city_growth():
    """Test city growth handler returns expected result."""
    runner = JobRunner()
    world_id = str(uuid4())

    # Mock _load_world_state and _save_growth_results to avoid DB
    districts = [
        {
            "id": str(uuid4()),
            "world_id": world_id,
            "type": "residential",
            "name": "Test District",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[0, 0], [1000, 0], [1000, 1000], [0, 1000], [0, 0]]],
            },
            "density": 3.0,
            "max_height": 8,
            "transit_access": False,
            "historic": False,
        }
    ]
    with (
        patch.object(
            runner, "_load_world_state", new_callable=AsyncMock,
            return_value=(districts, [], [], [], 42),
        ),
        patch.object(runner, "_save_growth_results", new_callable=AsyncMock),
    ):
        result = await runner._handle_city_growth(
            {"world_id": world_id, "years": 1},
        )

    assert "status" in result
    assert result["status"] == "simulated"
    assert "summary" in result


@pytest.mark.asyncio
async def test_job_handler_export_png():
    """Test PNG export handler returns expected result."""
    runner = JobRunner()
    result = await runner._handle_export_png({})

    assert "status" in result
    assert result["status"] == "exported"


@pytest.mark.asyncio
async def test_job_handler_export_gif():
    """Test GIF export handler returns expected result."""
    runner = JobRunner()
    result = await runner._handle_export_gif({})

    assert "status" in result
    assert result["status"] == "exported"


@pytest.mark.asyncio
async def test_run_job_handler_unknown_type():
    """Test that unknown job type raises ValueError."""
    runner = JobRunner()

    with pytest.raises(ValueError, match="Unknown job type"):
        await runner._run_job_handler("unknown_type", {})


@pytest.mark.asyncio
async def test_run_job_handler_valid_types():
    """Test that implemented job types are handled."""
    runner = JobRunner()

    # Test export job types that don't require complex params
    simple_types = [
        JobType.EXPORT_PNG,
        JobType.EXPORT_GIF,
    ]

    for job_type in simple_types:
        result = await runner._run_job_handler(job_type.value, {})
        assert isinstance(result, dict)
        assert "status" in result

    # Test terrain generation with required params
    with patch.object(runner, "_save_terrain_tiles", new_callable=AsyncMock):
        result = await runner._run_job_handler(
            JobType.TERRAIN_GENERATION.value,
            {"world_id": str(uuid4()), "world_seed": 42, "center_tx": 0, "center_ty": 0},
        )
        assert isinstance(result, dict)
        assert "status" in result

    # Test city growth with required params and mocked DB
    world_id = str(uuid4())
    with (
        patch.object(
            runner, "_load_world_state", new_callable=AsyncMock,
            return_value=([], [], [], [], 42),
        ),
        patch.object(runner, "_save_growth_results", new_callable=AsyncMock),
    ):
        result = await runner._run_job_handler(
            JobType.CITY_GROWTH.value, {"world_id": world_id},
        )
        assert isinstance(result, dict)
        assert "status" in result


# ============================================================================
# Additional Tests
# ============================================================================


def test_job_status_is_string_enum():
    """Test JobStatus values work as strings."""
    assert JobStatus.PENDING == "pending"
    assert JobStatus.COMPLETED.value == "completed"
    # Can be used in string contexts via .value
    assert f"Status: {JobStatus.FAILED.value}" == "Status: failed"


def test_job_type_is_string_enum():
    """Test JobType values work as strings."""
    assert JobType.TERRAIN_GENERATION == "terrain_generation"
    assert JobType.CITY_GROWTH.value == "city_growth"


def test_settings_custom_values():
    """Test Settings accepts custom values."""
    settings = Settings(
        poll_interval_seconds=5.0,
        max_concurrent_jobs=4,
        job_timeout_seconds=600,
    )
    assert settings.poll_interval_seconds == 5.0
    assert settings.max_concurrent_jobs == 4
    assert settings.job_timeout_seconds == 600


def test_job_runner_active_jobs_tracking():
    """Test JobRunner tracks active jobs correctly."""
    runner = JobRunner()
    job_id = uuid4()

    assert job_id not in runner._active_jobs

    runner._active_jobs.add(job_id)
    assert job_id in runner._active_jobs
    assert len(runner._active_jobs) == 1

    runner._active_jobs.discard(job_id)
    assert job_id not in runner._active_jobs
    assert len(runner._active_jobs) == 0


@pytest.mark.asyncio
async def test_wait_for_active_jobs_completes_when_empty():
    """Test _wait_for_active_jobs returns immediately when no active jobs."""
    runner = JobRunner()
    # Should complete almost immediately since there are no active jobs
    await asyncio.wait_for(runner._wait_for_active_jobs(timeout=1.0), timeout=0.5)


@pytest.mark.asyncio
async def test_wait_for_active_jobs_waits_for_jobs():
    """Test _wait_for_active_jobs waits while jobs are active."""
    runner = JobRunner()
    job_id = uuid4()
    runner._active_jobs.add(job_id)

    async def clear_job_after_delay():
        await asyncio.sleep(0.2)
        runner._active_jobs.discard(job_id)

    # Start task to clear job
    task = asyncio.create_task(clear_job_after_delay())

    # Wait should complete after job is cleared
    await runner._wait_for_active_jobs(timeout=1.0)

    await task
    assert len(runner._active_jobs) == 0


@pytest.mark.asyncio
async def test_wait_for_active_jobs_timeout():
    """Test _wait_for_active_jobs times out with stuck jobs."""
    runner = JobRunner()
    job_id = uuid4()
    runner._active_jobs.add(job_id)

    # Should timeout without clearing the job
    await runner._wait_for_active_jobs(timeout=0.3)

    # Job should still be in active set after timeout
    assert job_id in runner._active_jobs


@pytest.mark.asyncio
async def test_job_handler_with_params():
    """Test job handlers receive and can use params."""
    runner = JobRunner()
    params = {
        "world_id": str(uuid4()),
        "world_seed": 12345,
        "center_tx": 5,
        "center_ty": 3,
    }

    with patch.object(runner, "_save_terrain_tiles", new_callable=AsyncMock):
        result = await runner._handle_terrain_generation(params)

    assert result is not None
    assert "status" in result
    assert result["center_tile"]["tx"] == 5
    assert result["center_tile"]["ty"] == 3


@pytest.mark.asyncio
async def test_execute_job_success():
    """Test _execute_job completes successfully."""
    runner = JobRunner()
    job_id = uuid4()
    params = {
        "world_id": str(uuid4()),
        "world_seed": 42,
        "center_tx": 0,
        "center_ty": 0,
    }

    # Mock _update_job_status and _save_terrain_tiles to avoid database
    with (
        patch.object(runner, "_update_job_status", new_callable=AsyncMock) as mock_update,
        patch.object(runner, "_save_terrain_tiles", new_callable=AsyncMock),
    ):
        await runner._execute_job(job_id, JobType.TERRAIN_GENERATION.value, params)

        mock_update.assert_called_once()
        call_args = mock_update.call_args
        assert call_args[0][0] == job_id
        assert call_args[0][1] == JobStatus.COMPLETED


@pytest.mark.asyncio
async def test_execute_job_failure():
    """Test _execute_job handles handler failures."""
    runner = JobRunner()
    job_id = uuid4()

    # Mock handler to raise exception
    with (
        patch.object(runner, "_run_job_handler", side_effect=Exception("Test error")),
        patch.object(runner, "_update_job_status", new_callable=AsyncMock) as mock_update,
    ):
        await runner._execute_job(job_id, JobType.TERRAIN_GENERATION.value, {})

        mock_update.assert_called_once()
        call_args = mock_update.call_args
        assert call_args[0][0] == job_id
        assert call_args[0][1] == JobStatus.FAILED
        assert "Test error" in call_args[0][3]


@pytest.mark.asyncio
async def test_poll_and_execute_respects_max_concurrent():
    """Test _poll_and_execute respects max concurrent jobs limit."""
    runner = JobRunner()

    # Fill up active jobs to max
    from city_worker.config import settings

    for _ in range(settings.max_concurrent_jobs):
        runner._active_jobs.add(uuid4())

    # Mock _claim_job - should not be called when at max capacity
    with patch.object(runner, "_claim_job", new_callable=AsyncMock) as mock_claim:
        await runner._poll_and_execute()
        mock_claim.assert_not_called()


@pytest.mark.asyncio
async def test_poll_and_execute_no_job_available():
    """Test _poll_and_execute handles no available jobs."""
    runner = JobRunner()

    # Mock _claim_job to return None (no jobs)
    with patch.object(runner, "_claim_job", new_callable=AsyncMock, return_value=None):
        # Should complete without error
        await runner._poll_and_execute()
        assert len(runner._active_jobs) == 0
