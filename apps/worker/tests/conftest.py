"""Pytest configuration and fixtures for worker tests."""

import pytest


@pytest.fixture
def sample_config():
    """Sample configuration for worker tests."""
    return {
        "queue_url": "memory://",
        "concurrency": 1,
    }
