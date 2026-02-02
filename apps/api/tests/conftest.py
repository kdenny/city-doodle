"""Pytest configuration and fixtures for API tests."""

import pytest
from city_api.main import app
from city_api.repositories import tile_repository, world_repository
from httpx import ASGITransport, AsyncClient


@pytest.fixture
async def client():
    """Async test client for FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest.fixture(autouse=True)
def clear_repositories():
    """Clear all repositories before each test."""
    world_repository._worlds.clear()
    tile_repository._tiles.clear()
    tile_repository._coord_index.clear()
    yield
    world_repository._worlds.clear()
    tile_repository._tiles.clear()
    tile_repository._coord_index.clear()
