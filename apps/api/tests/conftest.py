"""Pytest configuration and fixtures for API tests."""

import asyncio
import os
from collections.abc import AsyncGenerator

import pytest
from city_api.database import Base, get_db
from city_api.main import app
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Use PostgreSQL for tests (from env var in CI, or local default)
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://localhost/city_doodle_test",
)

# Create test engine
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Override database dependency for tests."""
    async with test_session_factory() as session:
        yield session


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Create test database tables once per session."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(autouse=True)
async def clear_tables():
    """Clear all tables before each test."""
    async with test_session_factory() as session:
        # Delete in order respecting foreign keys
        await session.execute(text("DELETE FROM tile_locks"))
        await session.execute(text("DELETE FROM jobs"))
        await session.execute(text("DELETE FROM tiles"))
        await session.execute(text("DELETE FROM worlds"))
        await session.execute(text("DELETE FROM sessions"))
        await session.execute(text("DELETE FROM users"))
        await session.commit()
    yield


@pytest.fixture
async def client():
    """Async test client for FastAPI app."""
    # Override database dependency
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    # Clean up overrides
    app.dependency_overrides.clear()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session for tests that need direct DB access."""
    async with test_session_factory() as session:
        yield session
