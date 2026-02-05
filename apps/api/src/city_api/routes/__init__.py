"""API routes for City Doodle."""

from city_api.routes.districts import router as districts_router
from city_api.routes.jobs import router as jobs_router
from city_api.routes.locks import router as locks_router
from city_api.routes.road_network import router as road_network_router
from city_api.routes.seeds import router as seeds_router
from city_api.routes.tiles import router as tiles_router
from city_api.routes.transit import router as transit_router
from city_api.routes.worlds import router as worlds_router

__all__ = [
    "districts_router",
    "jobs_router",
    "locks_router",
    "road_network_router",
    "seeds_router",
    "tiles_router",
    "transit_router",
    "worlds_router",
]
