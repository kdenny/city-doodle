"""Job runner - polls and executes jobs from the database."""

import asyncio
import logging
import signal
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import text

from city_worker.config import settings
from city_worker.database import get_session
from city_worker.models import JobStatus, JobType

logger = logging.getLogger(__name__)


class JobRunner:
    """Polls the database for pending jobs and executes them."""

    def __init__(self) -> None:
        self._shutdown = False
        self._active_jobs: set[UUID] = set()

    async def run(self) -> None:
        """Main run loop - poll for and process jobs until shutdown."""
        logger.info("Job runner starting...")
        self._setup_signal_handlers()

        while not self._shutdown:
            try:
                await self._poll_and_execute()
            except Exception:
                logger.exception("Error in job polling loop")
                await asyncio.sleep(settings.poll_interval_seconds)

            if not self._shutdown:
                await asyncio.sleep(settings.poll_interval_seconds)

        logger.info("Job runner shutting down, waiting for active jobs...")
        await self._wait_for_active_jobs()
        logger.info("Job runner stopped")

    def _setup_signal_handlers(self) -> None:
        """Set up graceful shutdown on SIGINT/SIGTERM."""
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, self._handle_shutdown)

    def _handle_shutdown(self) -> None:
        """Handle shutdown signal."""
        logger.info("Shutdown signal received")
        self._shutdown = True

    async def _wait_for_active_jobs(self, timeout: float = 30.0) -> None:
        """Wait for active jobs to complete with timeout."""
        start = datetime.now(UTC)
        while self._active_jobs:
            elapsed = (datetime.now(UTC) - start).total_seconds()
            if elapsed > timeout:
                logger.warning(
                    "Timeout waiting for jobs to complete, %d jobs still active",
                    len(self._active_jobs),
                )
                break
            await asyncio.sleep(0.5)

    async def _poll_and_execute(self) -> None:
        """Poll for a pending job and execute it."""
        if len(self._active_jobs) >= settings.max_concurrent_jobs:
            return

        job = await self._claim_job()
        if job is None:
            return

        job_id, job_type, params = job
        self._active_jobs.add(job_id)
        try:
            await self._execute_job(job_id, job_type, params)
        finally:
            self._active_jobs.discard(job_id)

    async def _claim_job(self) -> tuple[UUID, str, dict] | None:
        """Claim a pending job using FOR UPDATE SKIP LOCKED.

        Returns (job_id, job_type, params) or None if no job available.
        """
        session = await get_session()
        try:
            async with session.begin():
                result = await session.execute(
                    text("""
                        SELECT id, type, params
                        FROM jobs
                        WHERE status = :pending
                        ORDER BY created_at ASC
                        LIMIT 1
                        FOR UPDATE SKIP LOCKED
                    """),
                    {"pending": JobStatus.PENDING.value},
                )
                row = result.fetchone()

                if row is None:
                    return None

                job_id, job_type, params = row
                job_id = UUID(str(job_id))

                await session.execute(
                    text("""
                        UPDATE jobs
                        SET status = :claimed, claimed_at = :now
                        WHERE id = :job_id
                    """),
                    {
                        "claimed": JobStatus.CLAIMED.value,
                        "now": datetime.now(UTC),
                        "job_id": job_id,
                    },
                )

                logger.info("Claimed job %s (type: %s)", job_id, job_type)
                return (job_id, job_type, params or {})
        finally:
            await session.close()

    async def _execute_job(self, job_id: UUID, job_type: str, params: dict) -> None:
        """Execute a job and update its status."""
        logger.info("Executing job %s (type: %s)", job_id, job_type)
        result: dict[str, Any] | None = None
        error: str | None = None

        try:
            result = await self._run_job_handler(job_type, params)
            status = JobStatus.COMPLETED
            logger.info("Job %s completed successfully", job_id)
        except Exception as e:
            logger.exception("Job %s failed", job_id)
            error = str(e)
            status = JobStatus.FAILED

        await self._update_job_status(job_id, status, result, error)

    async def _run_job_handler(self, job_type: str, params: dict) -> dict[str, Any]:
        """Run the appropriate handler for a job type.

        Returns result dict on success, raises on failure.
        """
        handlers = {
            JobType.TERRAIN_GENERATION.value: self._handle_terrain_generation,
            JobType.CITY_GROWTH.value: self._handle_city_growth,
            JobType.EXPORT_PNG.value: self._handle_export_png,
            JobType.EXPORT_GIF.value: self._handle_export_gif,
        }

        handler = handlers.get(job_type)
        if handler is None:
            raise ValueError(f"Unknown job type: {job_type}")

        return await handler(params)

    async def _update_job_status(
        self,
        job_id: UUID,
        status: JobStatus,
        result: dict | None,
        error: str | None,
    ) -> None:
        """Update job status in database."""
        session = await get_session()
        try:
            async with session.begin():
                await session.execute(
                    text("""
                        UPDATE jobs
                        SET status = :status,
                            result = :result,
                            error = :error,
                            completed_at = :now
                        WHERE id = :job_id
                    """),
                    {
                        "status": status.value,
                        "result": result,
                        "error": error,
                        "now": datetime.now(UTC),
                        "job_id": job_id,
                    },
                )
        finally:
            await session.close()

    async def _handle_terrain_generation(self, params: dict) -> dict[str, Any]:
        """Handle terrain generation job.

        Placeholder - will be implemented in CITY-13.
        """
        logger.info("Terrain generation job with params: %s", params)
        await asyncio.sleep(0.1)
        return {"status": "generated", "message": "Terrain generation not yet implemented"}

    async def _handle_city_growth(self, params: dict) -> dict[str, Any]:
        """Handle city growth simulation job.

        Placeholder - will be implemented in CITY-15.
        """
        logger.info("City growth job with params: %s", params)
        await asyncio.sleep(0.1)
        return {"status": "simulated", "message": "City growth not yet implemented"}

    async def _handle_export_png(self, params: dict) -> dict[str, Any]:
        """Handle PNG export job.

        Placeholder - will be implemented later.
        """
        logger.info("PNG export job with params: %s", params)
        await asyncio.sleep(0.1)
        return {"status": "exported", "message": "PNG export not yet implemented"}

    async def _handle_export_gif(self, params: dict) -> dict[str, Any]:
        """Handle GIF export job.

        Placeholder - will be implemented later.
        """
        logger.info("GIF export job with params: %s", params)
        await asyncio.sleep(0.1)
        return {"status": "exported", "message": "GIF export not yet implemented"}
