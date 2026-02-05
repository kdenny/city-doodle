"""API routes for City Doodle."""

from city_api.routes.jobs import router as jobs_router
from city_api.routes.locks import router as locks_router
from city_api.routes.seeds import router as seeds_router
from city_api.routes.tiles import router as tiles_router
from city_api.routes.worlds import router as worlds_router

__all__ = ["jobs_router", "locks_router", "seeds_router", "tiles_router", "worlds_router"]
