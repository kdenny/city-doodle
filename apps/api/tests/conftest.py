"""Pytest configuration and fixtures for API tests."""

import os
from collections.abc import AsyncGenerator
from uuid import UUID

import pytest
import pytest_asyncio
from city_api.database import Base, get_db
from city_api.main import app
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Test user IDs (must match the ones used in test files)
TEST_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
OTHER_USER_ID = UUID("00000000-0000-0000-0000-000000000002")

# Use SQLite for local tests, PostgreSQL in CI (when TEST_DATABASE_URL is set)
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "sqlite+aiosqlite:///:memory:",
)

# Create test engine with appropriate settings for the database type
is_sqlite = TEST_DATABASE_URL.startswith("sqlite")

if is_sqlite:
    # SQLite in-memory requires StaticPool to keep connection alive
    from sqlalchemy.pool import StaticPool

    test_engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    # PostgreSQL settings
    test_engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )

test_session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


# Note: Foreign key constraints are NOT enforced in SQLite tests for simplicity.
# The PostgreSQL tests in CI will enforce them properly.
# This allows tests to use arbitrary UUIDs without creating full entity hierarchies.


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Override database dependency for tests."""
    async with test_session_factory() as session:
        yield session


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
    """Clear all tables and create test users before each test."""
    # Use a raw connection to avoid session state issues
    async with test_engine.connect() as conn:
        if "postgresql" in TEST_DATABASE_URL:
            await conn.execute(
                text(
                    "TRUNCATE users, sessions, worlds, tiles, tile_locks, jobs RESTART IDENTITY CASCADE"
                )
            )
        else:
            await conn.execute(text("DELETE FROM tile_locks"))
            await conn.execute(text("DELETE FROM jobs"))
            await conn.execute(text("DELETE FROM tiles"))
            await conn.execute(text("DELETE FROM worlds"))
            await conn.execute(text("DELETE FROM sessions"))
            await conn.execute(text("DELETE FROM users"))

        # Create test users that tests expect to exist
        # These are the user IDs used in X-User-Id headers during dev mode testing
        # Note: SQLite stores UUIDs without hyphens, Postgres stores with hyphens
        test_user_id_str = str(TEST_USER_ID).replace("-", "") if is_sqlite else str(TEST_USER_ID)
        other_user_id_str = str(OTHER_USER_ID).replace("-", "") if is_sqlite else str(OTHER_USER_ID)

        await conn.execute(
            text("INSERT INTO users (id, email, password_hash) VALUES (:id, :email, :hash)"),
            {
                "id": test_user_id_str,
                "email": "test@example.com",
                "hash": "$2b$12$placeholder",  # Fake hash, not used in tests
            },
        )
        await conn.execute(
            text("INSERT INTO users (id, email, password_hash) VALUES (:id, :email, :hash)"),
            {
                "id": other_user_id_str,
                "email": "other@example.com",
                "hash": "$2b$12$placeholder",
            },
        )
        await conn.commit()
    yield


@pytest_asyncio.fixture
async def client(setup_test_db):
    """Async test client for FastAPI app."""
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def db_session(setup_test_db) -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session for tests that need direct DB access."""
    _, session_factory = get_test_engine()
    async with session_factory() as session:
        yield session
