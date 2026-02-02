"""Pytest configuration and fixtures for API tests."""

import pytest
from city_api.main import app
from httpx import ASGITransport, AsyncClient


@pytest.fixture
async def client():
    """Async test client for FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
