"""Tile lock repository - data access for tile locks."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from city_api.schemas import TileLock


class LockRepository:
    """In-memory lock repository. Will be replaced with database."""

    DEFAULT_LOCK_DURATION = 300  # 5 minutes
    MAX_LOCK_DURATION = 3600  # 1 hour

    def __init__(self) -> None:
        self._locks: dict[UUID, dict] = {}  # tile_id -> lock data

    def acquire(
        self,
        tile_id: UUID,
        user_id: UUID,
        duration_seconds: int | None = None,
    ) -> TileLock | None:
        """
        Acquire a lock on a tile.

        Returns the lock if acquired, None if already locked by another user.
        If the user already holds the lock, extends it.
        """
        duration = duration_seconds or self.DEFAULT_LOCK_DURATION
        duration = min(duration, self.MAX_LOCK_DURATION)

        now = datetime.now(UTC)
        existing = self._locks.get(tile_id)

        # Check if locked by another user
        if existing is not None:
            if existing["user_id"] != user_id and existing["expires_at"] > now:
                return None  # Locked by someone else
            # Either expired or same user - can acquire/extend

        lock_data = {
            "tile_id": tile_id,
            "user_id": user_id,
            "locked_at": now,
            "expires_at": now + timedelta(seconds=duration),
        }
        self._locks[tile_id] = lock_data
        return self._to_model(lock_data)

    def release(self, tile_id: UUID, user_id: UUID) -> bool:
        """
        Release a lock on a tile.

        Returns True if released, False if not locked or locked by another user.
        """
        existing = self._locks.get(tile_id)
        if existing is None:
            return False
        if existing["user_id"] != user_id:
            return False

        del self._locks[tile_id]
        return True

    def get(self, tile_id: UUID) -> TileLock | None:
        """Get the current lock on a tile, if any (and not expired)."""
        lock_data = self._locks.get(tile_id)
        if lock_data is None:
            return None

        # Check if expired
        now = datetime.now(UTC)
        if lock_data["expires_at"] <= now:
            # Clean up expired lock
            del self._locks[tile_id]
            return None

        return self._to_model(lock_data)

    def is_locked_by(self, tile_id: UUID, user_id: UUID) -> bool:
        """Check if a tile is locked by a specific user."""
        lock = self.get(tile_id)
        return lock is not None and lock.user_id == user_id

    def extend(self, tile_id: UUID, user_id: UUID, duration_seconds: int) -> TileLock | None:
        """
        Extend an existing lock.

        Returns the updated lock if successful, None if not locked by user.
        """
        lock_data = self._locks.get(tile_id)
        if lock_data is None:
            return None
        if lock_data["user_id"] != user_id:
            return None

        now = datetime.now(UTC)
        if lock_data["expires_at"] <= now:
            return None  # Expired

        duration = min(duration_seconds, self.MAX_LOCK_DURATION)
        lock_data["expires_at"] = now + timedelta(seconds=duration)
        return self._to_model(lock_data)

    def _to_model(self, lock_data: dict) -> TileLock:
        """Convert internal data to TileLock model."""
        return TileLock(
            tile_id=lock_data["tile_id"],
            user_id=lock_data["user_id"],
            locked_at=lock_data["locked_at"],
            expires_at=lock_data["expires_at"],
        )


# Singleton instance for the application
lock_repository = LockRepository()
