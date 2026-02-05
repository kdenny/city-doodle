"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from city_api.config import settings
from city_api.routers import auth_router
from city_api.routes import (
    districts_router,
    jobs_router,
    locks_router,
    neighborhoods_router,
    road_network_router,
    seeds_router,
    tiles_router,
    transit_router,
    worlds_router,
)

app = FastAPI(
    title="City Doodle API",
    description="Backend API for City Doodle - a lo-fi vector city builder",
    version="0.1.0",
)

# CORS middleware - allow frontend origins
origins = list(settings.cors_origins)
if settings.frontend_url and settings.frontend_url not in origins:
    origins.append(settings.frontend_url)

# Regex pattern for Vercel preview deployments
# Matches: https://city-doodle-web-*.vercel.app
vercel_preview_regex = r"https://city-doodle-web-[a-z0-9]+-[a-z0-9]+\.vercel\.app"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=vercel_preview_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(worlds_router)
app.include_router(tiles_router)
app.include_router(locks_router)
app.include_router(jobs_router)
app.include_router(seeds_router)
app.include_router(districts_router)
app.include_router(neighborhoods_router)
app.include_router(road_network_router)
app.include_router(transit_router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "city-api"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}
