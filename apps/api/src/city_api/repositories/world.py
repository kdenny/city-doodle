"""World repository - data access for worlds."""

import hashlib
from datetime import UTC, datetime
from uuid import UUID, uuid4

from city_api.schemas import World, WorldCreate, WorldSettings


class WorldRepository:
    """In-memory world repository. Will be replaced with database in CITY-6."""

    def __init__(self) -> None:
        self._worlds: dict[UUID, dict] = {}

    def create(self, world_create: WorldCreate, user_id: UUID) -> World:
        """Create a new world."""
        world_id = uuid4()
        now = datetime.now(UTC)

        # Generate deterministic seed if not provided
        if world_create.seed is not None:
            seed = world_create.seed
        else:
            # Generate seed from world name + user_id for determinism
            seed_input = f"{world_create.name}:{user_id}:{now.isoformat()}"
            seed = int(hashlib.sha256(seed_input.encode()).hexdigest()[:8], 16)

        world_data = {
            "id": world_id,
            "user_id": user_id,
            "name": world_create.name,
            "seed": seed,
            "settings": world_create.settings or WorldSettings(),
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        }
        self._worlds[world_id] = world_data
        return self._to_model(world_data)

    def get(self, world_id: UUID) -> dict | None:
        """Get a world by ID (returns raw data including user_id)."""
        world_data = self._worlds.get(world_id)
        if world_data is None or world_data.get("deleted_at") is not None:
            return None
        return world_data

    def get_by_id(self, world_id: UUID, user_id: UUID) -> World | None:
        """Get a world by ID for a specific user."""
        world_data = self.get(world_id)
        if world_data is None:
            return None
        if world_data["user_id"] != user_id:
            return None
        return self._to_model(world_data)

    def list_by_user(self, user_id: UUID) -> list[World]:
        """List all worlds for a user."""
        return [
            self._to_model(w)
            for w in self._worlds.values()
            if w["user_id"] == user_id and w.get("deleted_at") is None
        ]

    def delete(self, world_id: UUID, user_id: UUID) -> bool:
        """Soft delete a world. Returns True if deleted, False if not found/not owned."""
        world_data = self.get(world_id)
        if world_data is None:
            return False
        if world_data["user_id"] != user_id:
            return False
        world_data["deleted_at"] = datetime.now(UTC)
        return True

    def exists(self, world_id: UUID) -> bool:
        """Check if a world exists (regardless of ownership)."""
        return self.get(world_id) is not None

    def _to_model(self, world_data: dict) -> World:
        """Convert internal data to World model."""
        return World(
            id=world_data["id"],
            user_id=world_data["user_id"],
            name=world_data["name"],
            seed=world_data["seed"],
            settings=world_data["settings"],
            created_at=world_data["created_at"],
        )


# Singleton instance for the application
world_repository = WorldRepository()
