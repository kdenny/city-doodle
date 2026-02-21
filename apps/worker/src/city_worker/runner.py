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
            JobType.GROWTH_SIMULATION.value: self._handle_city_growth,
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
            world_settings: dict of world settings (beach_enabled, beach_width_multiplier, etc.)
        """
        from uuid import UUID

        from city_worker.terrain import TerrainConfig, TerrainGenerator, apply_seed_variation

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

        try:
            # Extract world settings if provided (from WorldSettings schema)
            world_settings = params.get("world_settings", {})

            # Update terrain_status to "generating"
            await self._update_tile_terrain_status(world_id, int(center_tx), int(center_ty), "generating")

            # Build terrain config from geographic setting presets + seed variation
            loop = asyncio.get_running_loop()
            geographic_setting = world_settings.get("geographic_setting", "coastal")
            config_kwargs = apply_seed_variation(geographic_setting, seed=int(world_seed))
            config_kwargs["world_seed"] = int(world_seed)
            config_kwargs["geographic_setting"] = geographic_setting
            # Explicit per-world overrides take precedence over preset
            if "beach_enabled" in world_settings:
                config_kwargs["beach_enabled"] = world_settings["beach_enabled"]
            if "beach_width_multiplier" in world_settings:
                config_kwargs["beach_width_multiplier"] = world_settings["beach_width_multiplier"]
            config = TerrainConfig(**config_kwargs)
            generator = TerrainGenerator(config)

            result = await loop.run_in_executor(
                None, generator.generate_3x3, int(center_tx), int(center_ty)
            )

            # CITY-582 debug: log generation result summary (remove in CITY-584)
            all_generated = result.all_tiles()
            logger.info(
                "[Terrain] Generation complete: world=%s tiles=%d total_features=%d setting=%s",
                world_id, len(all_generated),
                sum(len(t.features) for t in all_generated),
                geographic_setting,
            )

            # Save generated tiles to database
            await self._save_terrain_tiles(world_id, result)

            # Update terrain_status to "ready" for the center tile
            await self._update_tile_terrain_status(world_id, int(center_tx), int(center_ty), "ready")

            # Return summary
            all_tiles = result.all_tiles()
            total_features = sum(len(t.features) for t in all_tiles)

            return {
                "status": "generated",
                "tiles_generated": len(all_tiles),
                "total_features": total_features,
                "center_tile": {"tx": center_tx, "ty": center_ty},
            }
        except Exception as e:
            logger.exception("[Terrain] Generation failed for world=%s: %s", world_id, str(e))
            # Update tile status to failed
            try:
                await self._update_tile_terrain_status(
                    world_id, int(center_tx), int(center_ty), "failed", str(e)
                )
            except Exception:
                logger.exception("[Terrain] Failed to update terrain_status to 'failed'")
            raise

    async def _save_terrain_tiles(self, world_id: UUID, result: Any) -> None:
        """Save generated terrain tiles to the database."""
        from city_worker.terrain import TerrainResult

        result: TerrainResult = result
        session = await get_session()

        try:
            async with session.begin():
                # CITY-513: Use UPSERT instead of N+1 SELECT+INSERT/UPDATE per tile
                for tile_data in result.all_tiles():
                    terrain_dict = tile_data.to_dict()
                    features_dict = tile_data.features_to_geojson()

                    # CITY-582 debug: log GeoJSON features being saved (remove in CITY-584)
                    fc_type = features_dict.get("type") if isinstance(features_dict, dict) else None
                    fc_count = len(features_dict.get("features", [])) if isinstance(features_dict, dict) and fc_type == "FeatureCollection" else 0
                    logger.info(
                        "[Terrain] Saving tile tx=%s ty=%s world=%s fc_type=%s feature_count=%d",
                        tile_data.tx, tile_data.ty, world_id, fc_type, fc_count,
                    )

                    await session.execute(
                        text("""
                            INSERT INTO tiles (id, world_id, tx, ty, terrain_data, features, terrain_status, version)
                            VALUES (gen_random_uuid(), :world_id, :tx, :ty, :terrain_data, :features, 'ready', 1)
                            ON CONFLICT (world_id, tx, ty)
                            DO UPDATE SET
                                terrain_data = EXCLUDED.terrain_data,
                                features = EXCLUDED.features,
                                terrain_status = 'ready',
                                terrain_error = NULL,
                                version = tiles.version + 1,
                                updated_at = now()
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

    async def _update_tile_terrain_status(
        self,
        world_id: UUID,
        center_tx: int,
        center_ty: int,
        status: str,
        error: str | None = None,
    ) -> None:
        """Update terrain_status (and optionally terrain_error) for a tile."""
        session = await get_session()
        try:
            async with session.begin():
                await session.execute(
                    text("""
                        UPDATE tiles
                        SET terrain_status = :status,
                            terrain_error = :error,
                            updated_at = now()
                        WHERE world_id = :world_id AND tx = :tx AND ty = :ty
                    """),
                    {
                        "status": status,
                        "error": error,
                        "world_id": world_id,
                        "tx": center_tx,
                        "ty": center_ty,
                    },
                )
            logger.info(
                "[Terrain] Updated terrain_status=%s for world=%s tx=%s ty=%s",
                status, world_id, center_tx, center_ty,
            )
        finally:
            await session.close()

    async def _handle_city_growth(self, params: dict) -> dict[str, Any]:
        """Handle city growth simulation job.

        Simulates city growth over 1/5/10 year steps:
        - Infill development in existing districts
        - Expansion at district edges
        - New road connections
        - New supporting POIs
        - Respects historic district flag (no changes)

        Expected params:
            world_id: UUID of the world
            years: int time steps to simulate (1, 5, or 10)
        """
        from uuid import UUID

        from city_worker.growth import GrowthConfig, GrowthSimulator

        logger.info("City growth job with params: %s", params)

        # Validate params
        world_id = params.get("world_id")
        years = params.get("years", 1)
        if world_id is None:
            raise ValueError("world_id is required")

        world_id = UUID(world_id) if isinstance(world_id, str) else world_id
        years = max(1, min(int(years), 10))

        # Fetch current world state from DB
        districts, road_nodes, road_edges, pois, world_seed = (
            await self._load_world_state(world_id)
        )

        if not districts:
            return {
                "status": "skipped",
                "message": "No districts found in world",
                "changelog": {"entries": [], "summary": {}},
            }

        # Load water regions from terrain for expansion constraints
        water_regions = await self._load_water_regions(world_id)

        # Load transit stations for TOD growth (CITY-314)
        transit_stations = await self._load_transit_stations(world_id)

        # Run simulation
        config = GrowthConfig(world_id=world_id, years=years)
        simulator = GrowthSimulator(config, seed=world_seed)
        changelog = simulator.simulate(
            districts, road_nodes, road_edges, pois, water_regions,
            transit_stations,
        )

        # Persist changes back to DB
        await self._save_growth_results(
            world_id, districts, road_nodes, road_edges, pois, changelog,
        )

        result = changelog.to_dict()
        result["status"] = "simulated"
        return result

    async def _load_world_state(
        self, world_id: UUID,
    ) -> tuple[list[dict], list[dict], list[dict], list[dict], int]:
        """Load districts, road nodes, road edges, POIs, and world seed."""
        session = await get_session()
        try:
            # Get world seed
            result = await session.execute(
                text("SELECT seed FROM worlds WHERE id = :wid"),
                {"wid": world_id},
            )
            row = result.fetchone()
            world_seed = row[0] if row else 0

            # Fetch districts
            result = await session.execute(
                text("""
                    SELECT id, world_id, type, name, geometry, density,
                           max_height, transit_access, historic
                    FROM districts WHERE world_id = :wid
                """),
                {"wid": world_id},
            )
            districts = [
                {
                    "id": str(r[0]), "world_id": str(r[1]), "type": r[2],
                    "name": r[3], "geometry": r[4], "density": float(r[5]),
                    "max_height": r[6], "transit_access": r[7], "historic": r[8],
                }
                for r in result.fetchall()
            ]

            # Fetch road nodes
            result = await session.execute(
                text("""
                    SELECT id, world_id, position, node_type, name
                    FROM road_nodes WHERE world_id = :wid
                """),
                {"wid": world_id},
            )
            road_nodes = [
                {
                    "id": str(r[0]), "world_id": str(r[1]),
                    "position": r[2], "node_type": r[3], "name": r[4],
                }
                for r in result.fetchall()
            ]

            # Fetch road edges
            result = await session.execute(
                text("""
                    SELECT id, world_id, from_node_id, to_node_id, road_class,
                           geometry, length_meters, speed_limit, name,
                           is_one_way, lanes, district_id
                    FROM road_edges WHERE world_id = :wid
                """),
                {"wid": world_id},
            )
            road_edges = [
                {
                    "id": str(r[0]), "world_id": str(r[1]),
                    "from_node_id": str(r[2]), "to_node_id": str(r[3]),
                    "road_class": r[4], "geometry": r[5],
                    "length_meters": float(r[6]) if r[6] else 0,
                    "speed_limit": r[7], "name": r[8],
                    "is_one_way": r[9], "lanes": r[10],
                    "district_id": str(r[11]) if r[11] else None,
                }
                for r in result.fetchall()
            ]

            # Fetch POIs
            result = await session.execute(
                text("""
                    SELECT id, world_id, type, name, position_x, position_y
                    FROM pois WHERE world_id = :wid
                """),
                {"wid": world_id},
            )
            pois = [
                {
                    "id": str(r[0]), "world_id": str(r[1]),
                    "type": r[2], "name": r[3],
                    "position_x": float(r[4]), "position_y": float(r[5]),
                }
                for r in result.fetchall()
            ]

            return districts, road_nodes, road_edges, pois, world_seed
        finally:
            await session.close()

    async def _load_transit_stations(self, world_id: UUID) -> list[dict]:
        """Load transit station positions for TOD growth calculations."""
        session = await get_session()
        try:
            result = await session.execute(
                text("""
                    SELECT id, position_x, position_y, station_type
                    FROM transit_stations WHERE world_id = :wid
                """),
                {"wid": world_id},
            )
            return [
                {
                    "id": str(r[0]),
                    "position_x": float(r[1]),
                    "position_y": float(r[2]),
                    "station_type": r[3],
                }
                for r in result.fetchall()
            ]
        finally:
            await session.close()

    async def _load_water_regions(self, world_id: UUID) -> list[dict]:
        """Load water region geometries from terrain tiles for this world.

        Extracts coastline, lake, bay, and lagoon features from terrain data
        so the growth simulator can avoid expanding districts into water.
        """
        import json

        session = await get_session()
        try:
            result = await session.execute(
                text("""
                    SELECT terrain_data FROM tiles
                    WHERE world_id = :wid AND terrain_data IS NOT NULL
                """),
                {"wid": world_id},
            )
            water_types = {"coastline", "lake", "bay", "lagoon"}
            water_regions: list[dict] = []
            for (terrain_data,) in result.fetchall():
                if not terrain_data:
                    continue
                # terrain_data may be stored as JSON string or dict
                data = json.loads(terrain_data) if isinstance(terrain_data, str) else terrain_data
                features = data.get("features", [])
                for feat in features:
                    feat_type = feat.get("type", "")
                    geom = feat.get("geometry")
                    if feat_type in water_types and geom:
                        water_regions.append({"type": feat_type, "geometry": geom})
            return water_regions
        finally:
            await session.close()

    async def _save_growth_results(
        self,
        world_id: UUID,
        districts: list[dict],
        road_nodes: list[dict],
        road_edges: list[dict],
        pois: list[dict],
        changelog: Any,
    ) -> None:
        """Persist growth simulation results to the database."""
        session = await get_session()
        try:
            async with session.begin():
                now = datetime.now(UTC)

                # Update districts (density, max_height, geometry)
                for entry in changelog.entries:
                    if entry.entity_type != "district":
                        continue

                    district = next(
                        (d for d in districts if str(d["id"]) == entry.entity_id),
                        None,
                    )
                    if district is None:
                        continue

                    await session.execute(
                        text("""
                            UPDATE districts
                            SET density = :density,
                                max_height = :max_height,
                                geometry = :geometry,
                                updated_at = :now
                            WHERE id = :did
                        """),
                        {
                            "density": district["density"],
                            "max_height": district["max_height"],
                            "geometry": district["geometry"],
                            "now": now,
                            "did": district["id"],
                        },
                    )

                # Insert new road nodes
                for entry in changelog.entries:
                    if entry.entity_type != "road_node":
                        continue

                    node = next(
                        (n for n in road_nodes if str(n["id"]) == entry.entity_id),
                        None,
                    )
                    if node is None:
                        continue

                    await session.execute(
                        text("""
                            INSERT INTO road_nodes
                                (id, world_id, position, node_type, name)
                            VALUES
                                (:id, :world_id, :position, :node_type, :name)
                        """),
                        {
                            "id": node["id"],
                            "world_id": world_id,
                            "position": node["position"],
                            "node_type": node["node_type"],
                            "name": node.get("name"),
                        },
                    )

                # Insert new road edges
                for entry in changelog.entries:
                    if entry.entity_type != "road_edge":
                        continue

                    edge = next(
                        (e for e in road_edges if str(e["id"]) == entry.entity_id),
                        None,
                    )
                    if edge is None:
                        continue

                    await session.execute(
                        text("""
                            INSERT INTO road_edges
                                (id, world_id, from_node_id, to_node_id,
                                 road_class, geometry, length_meters,
                                 speed_limit, name, is_one_way, lanes, district_id)
                            VALUES
                                (:id, :world_id, :from_node_id, :to_node_id,
                                 :road_class, :geometry, :length_meters,
                                 :speed_limit, :name, :is_one_way, :lanes, :district_id)
                        """),
                        {
                            "id": edge["id"],
                            "world_id": world_id,
                            "from_node_id": edge["from_node_id"],
                            "to_node_id": edge["to_node_id"],
                            "road_class": edge["road_class"],
                            "geometry": edge.get("geometry", []),
                            "length_meters": edge.get("length_meters", 0),
                            "speed_limit": edge.get("speed_limit"),
                            "name": edge.get("name"),
                            "is_one_way": edge.get("is_one_way", False),
                            "lanes": edge.get("lanes", 2),
                            "district_id": edge.get("district_id"),
                        },
                    )

                # Insert new POIs
                for entry in changelog.entries:
                    if entry.entity_type != "poi":
                        continue

                    poi = next(
                        (p for p in pois if str(p["id"]) == entry.entity_id),
                        None,
                    )
                    if poi is None:
                        continue

                    await session.execute(
                        text("""
                            INSERT INTO pois
                                (id, world_id, type, name, position_x, position_y)
                            VALUES
                                (:id, :world_id, :type, :name, :position_x, :position_y)
                        """),
                        {
                            "id": poi["id"],
                            "world_id": world_id,
                            "type": poi["type"],
                            "name": poi["name"],
                            "position_x": poi["position_x"],
                            "position_y": poi["position_y"],
                        },
                    )

                logger.info(
                    "Saved growth results for world %s: %d infilled, %d expanded, "
                    "%d roads, %d POIs",
                    world_id,
                    changelog.districts_infilled,
                    changelog.districts_expanded,
                    changelog.roads_added,
                    changelog.pois_added,
                )
        finally:
            await session.close()

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
