"""Pytest configuration and fixtures for API tests."""

import asyncio
from collections.abc import AsyncGenerator

import pytest
<<<<<<< HEAD
from city_api.main import app
from city_api.repositories import lock_repository, tile_repository, world_repository
=======
>>>>>>> bab391d (CITY-94: Convert world and tile repositories to use database)
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from city_api.database import Base, get_db
from city_api.main import app

# Use SQLite in-memory for fast, isolated tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Create test engine
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session_factory = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


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

<<<<<<< HEAD
@pytest.fixture(autouse=True)
def clear_repositories():
    """Clear all repositories before each test."""
    world_repository._worlds.clear()
    tile_repository._tiles.clear()
    tile_repository._coord_index.clear()
    lock_repository._locks.clear()
    yield
    world_repository._worlds.clear()
    tile_repository._tiles.clear()
    tile_repository._coord_index.clear()
    lock_repository._locks.clear()
=======

@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session for tests that need direct DB access."""
    async with test_session_factory() as session:
        yield session
>>>>>>> bab391d (CITY-94: Convert world and tile repositories to use database)
