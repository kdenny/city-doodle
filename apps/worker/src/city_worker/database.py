"""Database connection for the worker."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from city_worker.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:
    """Get a new database session."""
    return async_session()
