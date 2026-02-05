"""FastAPI application entry point."""

import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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

logger = logging.getLogger(__name__)

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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler that logs errors and returns proper JSON responses.

    This ensures that:
    1. All errors are logged with stack traces for debugging
    2. CORS headers are included in error responses (handled by middleware)
    3. The frontend gets consistent error responses
    """
    logger.error(
        f"Unhandled exception on {request.method} {request.url}: {exc}\n"
        f"{traceback.format_exc()}"
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error_type": type(exc).__name__,
        },
    )
