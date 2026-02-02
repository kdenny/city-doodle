"""Tile lock repository - data access for tile locks."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from city_api.models import TileLock as TileLockModel
from city_api.schemas import TileLock

DEFAULT_LOCK_DURATION = 300  # 5 minutes
MAX_LOCK_DURATION = 3600  # 1 hour


def _ensure_utc(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware (UTC). SQLite returns naive datetimes."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


async def acquire_lock(
    db: AsyncSession,
    tile_id: UUID,
    user_id: UUID,
    duration_seconds: int | None = None,
) -> TileLock | None:
    """
    Acquire a lock on a tile.

    Returns the lock if acquired, None if already locked by another user.
    If the user already holds the lock, extends it.
    """
    duration = duration_seconds or DEFAULT_LOCK_DURATION
    duration = min(duration, MAX_LOCK_DURATION)

    now = datetime.now(UTC)

    # Check for existing lock
    result = await db.execute(select(TileLockModel).where(TileLockModel.tile_id == tile_id))
    existing = result.scalar_one_or_none()

    if existing is not None:
        if existing.user_id != user_id and _ensure_utc(existing.expires_at) > now:
            return None  # Locked by someone else

        # Either expired or same user - update the lock
        existing.user_id = user_id
        existing.locked_at = now
        existing.expires_at = now + timedelta(seconds=duration)
        await db.commit()
        await db.refresh(existing)
        return _to_schema(existing)

    # Create new lock
    lock = TileLockModel(
        tile_id=tile_id,
        user_id=user_id,
        locked_at=now,
        expires_at=now + timedelta(seconds=duration),
    )
    db.add(lock)
    await db.commit()
    await db.refresh(lock)
    return _to_schema(lock)


async def release_lock(db: AsyncSession, tile_id: UUID, user_id: UUID) -> bool:
    """
    Release a lock on a tile.

    Returns True if released, False if not locked or locked by another user.
    """
    result = await db.execute(select(TileLockModel).where(TileLockModel.tile_id == tile_id))
    existing = result.scalar_one_or_none()
    if existing is None:
        return False
    if existing.user_id != user_id:
        return False

    await db.execute(delete(TileLockModel).where(TileLockModel.tile_id == tile_id))
    await db.commit()
    return True


async def get_lock(db: AsyncSession, tile_id: UUID) -> TileLock | None:
    """Get the current lock on a tile, if any (and not expired)."""
    result = await db.execute(select(TileLockModel).where(TileLockModel.tile_id == tile_id))
    lock = result.scalar_one_or_none()
    if lock is None:
        return None

    # Check if expired
    now = datetime.now(UTC)
    if _ensure_utc(lock.expires_at) <= now:
        # Clean up expired lock
        await db.execute(delete(TileLockModel).where(TileLockModel.tile_id == tile_id))
        await db.commit()
        return None

    return _to_schema(lock)


async def is_locked_by(db: AsyncSession, tile_id: UUID, user_id: UUID) -> bool:
    """Check if a tile is locked by a specific user."""
    lock = await get_lock(db, tile_id)
    return lock is not None and lock.user_id == user_id


async def extend_lock(
    db: AsyncSession, tile_id: UUID, user_id: UUID, duration_seconds: int
) -> TileLock | None:
    """
    Extend an existing lock.

    Returns the updated lock if successful, None if not locked by user.
    """
    result = await db.execute(select(TileLockModel).where(TileLockModel.tile_id == tile_id))
    lock = result.scalar_one_or_none()
    if lock is None:
        return None
    if lock.user_id != user_id:
        return None

    now = datetime.now(UTC)
    if _ensure_utc(lock.expires_at) <= now:
        return None  # Expired

    duration = min(duration_seconds, MAX_LOCK_DURATION)
    lock.expires_at = now + timedelta(seconds=duration)
    await db.commit()
    await db.refresh(lock)
    return _to_schema(lock)


def _to_schema(lock: TileLockModel) -> TileLock:
    """Convert SQLAlchemy model to Pydantic schema."""
    return TileLock(
        tile_id=lock.tile_id,
        user_id=lock.user_id,
        locked_at=_ensure_utc(lock.locked_at),
        expires_at=_ensure_utc(lock.expires_at),
    )
