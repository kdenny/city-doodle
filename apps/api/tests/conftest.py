"""Pytest configuration and fixtures for API tests."""

import pytest
from httpx import ASGITransport, AsyncClient

from city_api.main import app
from city_api.repositories import world_repository


@pytest.fixture
async def client():
    """Async test client for FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest.fixture(autouse=True)
def clear_world_repository():
    """Clear the world repository before each test."""
    world_repository._worlds.clear()
    yield
    world_repository._worlds.clear()
