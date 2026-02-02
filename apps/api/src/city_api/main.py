"""FastAPI application entry point."""

from fastapi import FastAPI

from city_api.schemas import (
    District,
    DistrictCreate,
    Job,
    JobCreate,
    Tile,
    TileCreate,
    TileLock,
    TileLockCreate,
    World,
    WorldCreate,
)

app = FastAPI(
    title="City Doodle API",
    description="Backend API for City Doodle - a lo-fi vector city builder",
    version="0.1.0",
)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "city-api"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


# =============================================================================
# World endpoints (stubs - implementation in CITY-8)
# =============================================================================


@app.post("/worlds", response_model=World, tags=["worlds"])
async def create_world(world: WorldCreate) -> World:
    """Create a new world."""
    raise NotImplementedError("Endpoint not yet implemented")


@app.get("/worlds", response_model=list[World], tags=["worlds"])
async def list_worlds() -> list[World]:
    """List all worlds for the current user."""
    raise NotImplementedError("Endpoint not yet implemented")


@app.get("/worlds/{world_id}", response_model=World, tags=["worlds"])
async def get_world(world_id: str) -> World:
    """Get a world by ID."""
    raise NotImplementedError("Endpoint not yet implemented")


# =============================================================================
# Tile endpoints (stubs - implementation in CITY-9)
# =============================================================================


@app.post("/tiles", response_model=Tile, tags=["tiles"])
async def create_tile(tile: TileCreate) -> Tile:
    """Create a new tile."""
    raise NotImplementedError("Endpoint not yet implemented")


@app.get("/worlds/{world_id}/tiles", response_model=list[Tile], tags=["tiles"])
async def list_tiles(world_id: str) -> list[Tile]:
    """List all tiles in a world."""
    raise NotImplementedError("Endpoint not yet implemented")


@app.get("/tiles/{tile_id}", response_model=Tile, tags=["tiles"])
async def get_tile(tile_id: str) -> Tile:
    """Get a tile by ID."""
    raise NotImplementedError("Endpoint not yet implemented")


# =============================================================================
# Tile locking endpoints (stubs - implementation in CITY-10)
# =============================================================================


@app.post("/tiles/locks", response_model=TileLock, tags=["tile-locks"])
async def acquire_lock(lock: TileLockCreate) -> TileLock:
    """Acquire a lock on a tile for editing."""
    raise NotImplementedError("Endpoint not yet implemented")


@app.delete("/tiles/{tile_id}/lock", tags=["tile-locks"])
async def release_lock(tile_id: str) -> dict:
    """Release a lock on a tile."""
    raise NotImplementedError("Endpoint not yet implemented")


@app.get("/tiles/{tile_id}/lock", response_model=TileLock | None, tags=["tile-locks"])
async def get_lock(tile_id: str) -> TileLock | None:
    """Get the current lock on a tile."""
    raise NotImplementedError("Endpoint not yet implemented")


# =============================================================================
# Job endpoints (stubs - implementation in CITY-11)
# =============================================================================


@app.post("/jobs", response_model=Job, tags=["jobs"])
async def create_job(job: JobCreate) -> Job:
    """Create a new background job."""
    raise NotImplementedError("Endpoint not yet implemented")


@app.get("/jobs/{job_id}", response_model=Job, tags=["jobs"])
async def get_job(job_id: str) -> Job:
    """Get a job by ID."""
    raise NotImplementedError("Endpoint not yet implemented")


@app.get("/jobs", response_model=list[Job], tags=["jobs"])
async def list_jobs() -> list[Job]:
    """List jobs for the current user."""
    raise NotImplementedError("Endpoint not yet implemented")


# =============================================================================
# District endpoints (stubs - implementation in CITY-14)
# =============================================================================


@app.post("/districts", response_model=District, tags=["districts"])
async def create_district(district: DistrictCreate) -> District:
    """Create a new district on a tile."""
    raise NotImplementedError("Endpoint not yet implemented")


@app.get("/tiles/{tile_id}/districts", response_model=list[District], tags=["districts"])
async def list_districts(tile_id: str) -> list[District]:
    """List all districts on a tile."""
    raise NotImplementedError("Endpoint not yet implemented")


@app.get("/districts/{district_id}", response_model=District, tags=["districts"])
async def get_district(district_id: str) -> District:
    """Get a district by ID."""
    raise NotImplementedError("Endpoint not yet implemented")
