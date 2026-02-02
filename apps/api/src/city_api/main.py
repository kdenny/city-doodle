"""FastAPI application entry point."""

from fastapi import FastAPI

from city_api.routers import auth_router
from city_api.routes import jobs_router, locks_router, tiles_router, worlds_router
from city_api.schemas import (
    District,
    DistrictCreate,
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
app.include_router(jobs_router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "city-api"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


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
