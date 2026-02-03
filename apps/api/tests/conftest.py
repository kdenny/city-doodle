"""Pytest configuration and fixtures for API tests."""

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

# Create test engine with pool_pre_ping to handle stale connections
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)
test_session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Override database dependency for tests."""
    async with test_session_factory() as session:
        yield session


# Note: event_loop fixture is no longer needed with pytest-asyncio >= 0.23
# when asyncio_default_fixture_loop_scope = "session" is set in pyproject.toml


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
    # Use a raw connection to avoid session state issues
    async with test_engine.connect() as conn:
        # Use TRUNCATE CASCADE for efficient cleanup (Postgres-specific)
        if "postgresql" in TEST_DATABASE_URL:
            await conn.execute(
                text(
                    "TRUNCATE users, sessions, worlds, tiles, tile_locks, jobs RESTART IDENTITY CASCADE"
                )
            )
        else:
            # Fallback for SQLite (manual delete order)
            await conn.execute(text("DELETE FROM tile_locks"))
            await conn.execute(text("DELETE FROM jobs"))
            await conn.execute(text("DELETE FROM tiles"))
            await conn.execute(text("DELETE FROM worlds"))
            await conn.execute(text("DELETE FROM sessions"))
            await conn.execute(text("DELETE FROM users"))
        await conn.commit()
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
