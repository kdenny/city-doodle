"""Tile locking endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from city_api.database import get_db
from city_api.dependencies import get_current_user
from city_api.repositories import lock as lock_repo
from city_api.schemas import TileLock, TileLockCreate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tiles", tags=["tile-locks"])


@router.post("/{tile_id}/lock", response_model=TileLock)
async def acquire_lock(
    tile_id: UUID,
    lock_request: TileLockCreate | None = None,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> TileLock:
    """
    Acquire a lock on a tile for editing.

    Locks expire after 5 minutes by default. Use the heartbeat endpoint
    to extend an active lock.

    Returns 409 Conflict if the tile is already locked by another user.
    """
    duration = lock_request.duration_seconds if lock_request else None

    lock = await lock_repo.acquire_lock(db, tile_id, user_id, duration)
    if lock is None:
        # Get existing lock info for error message
        existing_lock = await lock_repo.get_lock(db, tile_id)
        if existing_lock:
            logger.info(
                "Lock conflict: tile_id=%s requester=%s holder=%s expires=%s",
                tile_id,
                user_id,
                existing_lock.user_id,
                existing_lock.expires_at,
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Tile is locked by another user",
                    "locked_by": str(existing_lock.user_id),
                    "expires_at": existing_lock.expires_at.isoformat(),
                },
            )
        logger.warning(
            "Lock acquisition failed unexpectedly: tile_id=%s user_id=%s", tile_id, user_id
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Failed to acquire lock",
        )

    return lock


@router.delete("/{tile_id}/lock", status_code=status.HTTP_204_NO_CONTENT)
async def release_lock(
    tile_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> None:
    """
    Release a lock on a tile.

    Only the user who holds the lock can release it.
    Returns 404 if the tile is not locked or locked by another user.
    """
    released = await lock_repo.release_lock(db, tile_id, user_id)
    if not released:
        existing_lock = await lock_repo.get_lock(db, tile_id)
        if existing_lock and existing_lock.user_id != user_id:
            logger.warning(
                "Unauthorized lock release: tile_id=%s holder=%s requester=%s",
                tile_id,
                existing_lock.user_id,
                user_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Lock is held by another user",
            )
        logger.info("Release attempted on unlocked tile: tile_id=%s user_id=%s", tile_id, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active lock on this tile",
        )


@router.get("/{tile_id}/lock", response_model=TileLock | None)
async def get_lock(
    tile_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> TileLock | None:
    """
    Get the current lock status of a tile.

    Returns the lock details if locked, null if not locked.
    """
    return await lock_repo.get_lock(db, tile_id)


@router.post("/{tile_id}/lock/heartbeat", response_model=TileLock)
async def heartbeat_lock(
    tile_id: UUID,
    duration_seconds: int = 300,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> TileLock:
    """
    Extend an active lock.

    Use this endpoint to keep a lock active while the user is editing.
    Returns 404 if the lock doesn't exist or is held by another user.
    """
    lock = await lock_repo.extend_lock(db, tile_id, user_id, duration_seconds)
    if lock is None:
        existing_lock = await lock_repo.get_lock(db, tile_id)
        if existing_lock and existing_lock.user_id != user_id:
            logger.warning(
                "Unauthorized lock extend: tile_id=%s holder=%s requester=%s",
                tile_id,
                existing_lock.user_id,
                user_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Lock is held by another user",
            )
        logger.info("Heartbeat on unlocked tile: tile_id=%s user_id=%s", tile_id, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active lock to extend",
        )

    return lock
