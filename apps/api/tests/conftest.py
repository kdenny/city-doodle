"""Pytest configuration and fixtures for API tests."""

import pytest
from httpx import ASGITransport, AsyncClient

from city_api.main import app


@pytest.fixture
async def client():
    """Async test client for FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
