"""Tests for worker module."""

import pytest
from city_worker.config import Settings
from city_worker.models import JobStatus, JobType
from city_worker.runner import JobRunner


def test_job_status_values():
    """Test JobStatus enum has expected values."""
    assert JobStatus.PENDING.value == "pending"
    assert JobStatus.CLAIMED.value == "claimed"
    assert JobStatus.COMPLETED.value == "completed"
    assert JobStatus.FAILED.value == "failed"


def test_job_type_values():
    """Test JobType enum has expected values."""
    assert JobType.TERRAIN_GENERATION.value == "terrain_generation"
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
    result = await runner._handle_terrain_generation({})

    assert "status" in result
    assert result["status"] == "generated"


@pytest.mark.asyncio
async def test_job_handler_city_growth():
    """Test city growth handler returns expected result."""
    runner = JobRunner()
    result = await runner._handle_city_growth({})

    assert "status" in result
    assert result["status"] == "simulated"


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
    """Test that all valid job types are handled."""
    runner = JobRunner()

    for job_type in JobType:
        result = await runner._run_job_handler(job_type.value, {})
        assert isinstance(result, dict)
        assert "status" in result
