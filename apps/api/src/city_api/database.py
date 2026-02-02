"""Database connection and session management."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""

    pass


# Lazy-loaded engine and session factory (avoids import-time errors for Alembic)
_engine = None
_async_session = None


def get_engine():
    """Get or create the async engine."""
    global _engine
    if _engine is None:
        from city_api.config import settings

        _engine = create_async_engine(settings.database_url, echo=False)
    return _engine


def get_session_factory():
    """Get or create the async session factory."""
    global _async_session
    if _async_session is None:
        _async_session = async_sessionmaker(
            get_engine(), class_=AsyncSession, expire_on_commit=False
        )
    return _async_session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that yields a database session."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        yield session
