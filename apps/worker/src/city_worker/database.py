"""Database connection for the worker."""

import re

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from city_worker.config import settings


def _transform_url_for_asyncpg(url: str) -> str:
    """Transform database URL for asyncpg compatibility.

    asyncpg doesn't support 'sslmode' parameter — it uses 'ssl' instead.
    """
    return re.sub(r"sslmode=(\w+)", r"ssl=\1", url)


engine = create_async_engine(_transform_url_for_asyncpg(settings.database_url), echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:
    """Get a new database session."""
    return async_session()
