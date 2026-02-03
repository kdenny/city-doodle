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

        Generates terrain for a 3x3 tile neighborhood and saves to database.

        Expected params:
            world_id: UUID of the world
            world_seed: int seed for deterministic generation
            center_tx: int x-coordinate of center tile
            center_ty: int y-coordinate of center tile
        """
        from uuid import UUID

        from city_worker.terrain import TerrainConfig, TerrainGenerator

        logger.info("Terrain generation job with params: %s", params)

        # Validate required params
        world_id = params.get("world_id")
        world_seed = params.get("world_seed")
        center_tx = params.get("center_tx", 0)
        center_ty = params.get("center_ty", 0)

        if world_id is None:
            raise ValueError("world_id is required")
        if world_seed is None:
            raise ValueError("world_seed is required")

        world_id = UUID(world_id) if isinstance(world_id, str) else world_id

        # Run terrain generation in thread pool (CPU-bound)
        loop = asyncio.get_running_loop()
        config = TerrainConfig(world_seed=int(world_seed))
        generator = TerrainGenerator(config)

        result = await loop.run_in_executor(
            None, generator.generate_3x3, int(center_tx), int(center_ty)
        )

        # Save generated tiles to database
        await self._save_terrain_tiles(world_id, result)

        # Return summary
        all_tiles = result.all_tiles()
        total_features = sum(len(t.features) for t in all_tiles)

        return {
            "status": "generated",
            "tiles_generated": len(all_tiles),
            "total_features": total_features,
            "center_tile": {"tx": center_tx, "ty": center_ty},
        }

    async def _save_terrain_tiles(self, world_id: UUID, result: Any) -> None:
        """Save generated terrain tiles to the database."""
        from city_worker.terrain import TerrainResult

        result: TerrainResult = result
        session = await get_session()

        try:
            async with session.begin():
                for tile_data in result.all_tiles():
                    # Check if tile exists
                    existing = await session.execute(
                        text("""
                            SELECT id FROM tiles
                            WHERE world_id = :world_id AND tx = :tx AND ty = :ty
                        """),
                        {"world_id": world_id, "tx": tile_data.tx, "ty": tile_data.ty},
                    )
                    row = existing.fetchone()

                    terrain_dict = tile_data.to_dict()
                    features_dict = tile_data.features_to_geojson()

                    if row:
                        # Update existing tile
                        await session.execute(
                            text("""
                                UPDATE tiles
                                SET terrain_data = :terrain_data,
                                    features = :features,
                                    version = version + 1,
                                    updated_at = :now
                                WHERE id = :tile_id
                            """),
                            {
                                "tile_id": row[0],
                                "terrain_data": terrain_dict,
                                "features": features_dict,
                                "now": datetime.now(UTC),
                            },
                        )
                    else:
                        # Insert new tile
                        await session.execute(
                            text("""
                                INSERT INTO tiles (id, world_id, tx, ty, terrain_data, features, version)
                                VALUES (gen_random_uuid(), :world_id, :tx, :ty, :terrain_data, :features, 1)
                            """),
                            {
                                "world_id": world_id,
                                "tx": tile_data.tx,
                                "ty": tile_data.ty,
                                "terrain_data": terrain_dict,
                                "features": features_dict,
                            },
                        )

                logger.info(
                    "Saved %d terrain tiles for world %s",
                    len(result.all_tiles()),
                    world_id,
                )
        finally:
            await session.close()

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
