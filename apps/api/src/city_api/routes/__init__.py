"""API routes for City Doodle."""

from city_api.routes.locks import router as locks_router
from city_api.routes.tiles import router as tiles_router
from city_api.routes.worlds import router as worlds_router

__all__ = ["worlds_router", "tiles_router", "locks_router"]
