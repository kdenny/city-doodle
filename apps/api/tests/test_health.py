"""Tests for health check endpoints."""

import pytest


@pytest.mark.asyncio
async def test_root_endpoint(client):
    """Test root endpoint returns ok status."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "city-api"


@pytest.mark.asyncio
async def test_health_endpoint(client):
    """Test health endpoint returns healthy status."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
