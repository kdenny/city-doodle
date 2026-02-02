"""FastAPI application entry point."""

from fastapi import FastAPI

from city_api.routers import auth_router
from city_api.routes import locks_router, tiles_router, worlds_router
from city_api.schemas import (
    District,
    DistrictCreate,
    Job,
    JobCreate,
)

app = FastAPI(
    title="City Doodle API",
    description="Backend API for City Doodle - a lo-fi vector city builder",
    version="0.1.0",
)

app.include_router(auth_router)
app.include_router(worlds_router)
app.include_router(tiles_router)
app.include_router(locks_router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "city-api"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


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
