"""Pytest configuration and fixtures for API tests."""

import os
from collections.abc import AsyncGenerator
from uuid import UUID

import pytest
from city_api.database import Base, get_db
from city_api.main import app
from city_api.models import User
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# Use PostgreSQL for tests (from env var in CI, or local default)
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://localhost/city_doodle_test",
)

# Test user IDs matching those used in test files
TEST_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
OTHER_USER_ID = UUID("00000000-0000-0000-0000-000000000002")

# Note: Engine is created inside a fixture to ensure it's bound to the correct event loop
# Do NOT create engine at module level - it causes "Task got Future attached to a different loop" errors
_test_engine = None
_test_session_factory = None


def get_test_engine():
    """Get or create the test engine (lazy initialization)."""
    global _test_engine
    if _test_engine is None:
        _test_engine = create_async_engine(
            TEST_DATABASE_URL,
            echo=False,
            poolclass=NullPool,  # Disable pooling to avoid connection state issues in tests
        )
    return _test_engine


def get_test_session_factory():
    """Get or create the test session factory (lazy initialization)."""
    global _test_session_factory
    if _test_session_factory is None:
        _test_session_factory = async_sessionmaker(
            get_test_engine(), class_=AsyncSession, expire_on_commit=False
        )
    return _test_session_factory


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Override database dependency for tests."""
    async with get_test_session_factory()() as session:
        yield session


# Note: event_loop fixture is no longer needed with pytest-asyncio >= 0.23
# when asyncio_default_fixture_loop_scope = "session" is set in pyproject.toml


@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Create test database tables once per session."""
    engine = get_test_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    # Clean up engine at end of session
    await engine.dispose()


@pytest.fixture(autouse=True)
async def clear_tables():
    """Clear all tables before each test and create test users."""
    engine = get_test_engine()
    # Use a raw connection to avoid session state issues
    async with engine.connect() as conn:
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

    # Create test users that tests expect to exist
    async with get_test_session_factory()() as session:
        test_user = User(
            id=TEST_USER_ID,
            email="test@example.com",
            password_hash="$2b$12$placeholder",  # Not used in tests
        )
        other_user = User(
            id=OTHER_USER_ID,
            email="other@example.com",
            password_hash="$2b$12$placeholder",
        )
        session.add(test_user)
        session.add(other_user)
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
    async with get_test_session_factory()() as session:
        yield session
