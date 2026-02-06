"""World repository - data access for worlds."""

import hashlib
import logging
from datetime import UTC, datetime
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from city_api.models import World as WorldModel
from city_api.schemas import World, WorldCreate, WorldSettings, WorldUpdate

logger = logging.getLogger(__name__)


def _ensure_utc(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware (UTC). SQLite returns naive datetimes."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


async def create_world(db: AsyncSession, world_create: WorldCreate, user_id: UUID) -> World:
    """Create a new world."""
    now = datetime.now(UTC)

    # Generate deterministic seed if not provided
    if world_create.seed is not None:
        seed = world_create.seed
    else:
        # Generate unique seed from world name + user_id + timestamp
        # Includes timestamp so same-named worlds get different seeds
        # Mask to int32 range to avoid PostgreSQL integer overflow
        seed_input = f"{world_create.name}:{user_id}:{now.isoformat()}"
        seed = int(hashlib.sha256(seed_input.encode()).hexdigest()[:8], 16) & 0x7FFFFFFF

    # Convert settings to dict for JSONB storage
    settings_dict = (world_create.settings or WorldSettings()).model_dump()

    world = WorldModel(
        user_id=user_id,
        name=world_create.name,
        seed=seed,
        settings=settings_dict,
    )
    db.add(world)
    await db.commit()
    await db.refresh(world)

    return _to_schema(world)


async def get_world(db: AsyncSession, world_id: UUID) -> WorldModel | None:
    """Get a world by ID (returns SQLAlchemy model for ownership checks)."""
    result = await db.execute(select(WorldModel).where(WorldModel.id == world_id))
    return result.scalar_one_or_none()


async def get_world_for_user(db: AsyncSession, world_id: UUID, user_id: UUID) -> World | None:
    """Get a world by ID if owned by user."""
    result = await db.execute(
        select(WorldModel).where(WorldModel.id == world_id, WorldModel.user_id == user_id)
    )
    world = result.scalar_one_or_none()
    if world is None:
        return None
    return _to_schema(world)


async def list_worlds_for_user(db: AsyncSession, user_id: UUID) -> list[World]:
    """List all worlds for a user."""
    result = await db.execute(
        select(WorldModel)
        .where(WorldModel.user_id == user_id)
        .order_by(WorldModel.created_at.desc())
    )
    worlds = result.scalars().all()
    return [_to_schema(w) for w in worlds]


async def delete_world(db: AsyncSession, world_id: UUID, user_id: UUID) -> bool:
    """Delete a world. Returns True if deleted, False if not found/not owned."""
    result = await db.execute(
        delete(WorldModel).where(WorldModel.id == world_id, WorldModel.user_id == user_id)
    )
    await db.commit()
    return result.rowcount > 0


async def world_exists(db: AsyncSession, world_id: UUID) -> bool:
    """Check if a world exists (regardless of ownership)."""
    result = await db.execute(select(WorldModel.id).where(WorldModel.id == world_id))
    return result.scalar_one_or_none() is not None


async def update_world(
    db: AsyncSession, world_id: UUID, user_id: UUID, update: WorldUpdate
) -> World | None:
    """Update a world's settings. Returns None if not found or not owned by user."""
    result = await db.execute(
        select(WorldModel).where(WorldModel.id == world_id, WorldModel.user_id == user_id)
    )
    world = result.scalar_one_or_none()
    if world is None:
        return None

    # Update fields if provided
    if update.name is not None:
        world.name = update.name
    if update.settings is not None:
        world.settings = update.settings.model_dump()

    await db.commit()
    await db.refresh(world)
    return _to_schema(world)


def _to_schema(world: WorldModel) -> World:
    """Convert SQLAlchemy model to Pydantic schema."""
    try:
        settings = WorldSettings.model_validate(world.settings)
    except ValidationError:
        # Legacy data may not match current schema constraints (e.g. after
        # range changes).  Fall back to defaults, preserving any valid fields.
        raw = world.settings if isinstance(world.settings, dict) else {}
        defaults = WorldSettings()
        merged = {**defaults.model_dump(), **raw}
        # Use construct() to bypass validation — the defaults are known-good
        # and out-of-range legacy values are acceptable for existing worlds.
        settings = WorldSettings.model_construct(**merged)
        logger.warning(
            "World %s has settings that fail current validation; using lenient parse",
            world.id,
        )

    return World(
        id=world.id,
        user_id=world.user_id,
        name=world.name,
        seed=world.seed,
        settings=settings,
        created_at=_ensure_utc(world.created_at),
    )
