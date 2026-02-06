"""Tile repository - data access for tiles."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from city_api.models import Tile as TileModel
from city_api.schemas import TerrainData, Tile, TileCreate, TileFeatures, TileUpdate


def _ensure_utc(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware (UTC). SQLite returns naive datetimes."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


async def create_tile(db: AsyncSession, tile_create: TileCreate) -> Tile:
    """Create a new tile."""
    tile = TileModel(
        world_id=tile_create.world_id,
        tx=tile_create.tx,
        ty=tile_create.ty,
        terrain_data={},
        features={},
    )
    db.add(tile)
    await db.commit()
    await db.refresh(tile)
    return _to_schema(tile)


async def get_tile(db: AsyncSession, tile_id: UUID) -> TileModel | None:
    """Get a tile by ID (returns SQLAlchemy model)."""
    result = await db.execute(select(TileModel).where(TileModel.id == tile_id))
    return result.scalar_one_or_none()


async def get_tile_schema(db: AsyncSession, tile_id: UUID) -> Tile | None:
    """Get a tile by ID as Pydantic schema."""
    tile = await get_tile(db, tile_id)
    if tile is None:
        return None
    return _to_schema(tile)


async def get_tile_by_coords(db: AsyncSession, world_id: UUID, tx: int, ty: int) -> Tile | None:
    """Get a tile by world and coordinates."""
    result = await db.execute(
        select(TileModel).where(
            TileModel.world_id == world_id,
            TileModel.tx == tx,
            TileModel.ty == ty,
        )
    )
    tile = result.scalar_one_or_none()
    if tile is None:
        return None
    return _to_schema(tile)


async def list_tiles_by_world(
    db: AsyncSession,
    world_id: UUID,
    min_tx: int | None = None,
    max_tx: int | None = None,
    min_ty: int | None = None,
    max_ty: int | None = None,
) -> list[Tile]:
    """List tiles in a world, optionally filtered by bounding box."""
    conditions = [TileModel.world_id == world_id]

    if min_tx is not None:
        conditions.append(TileModel.tx >= min_tx)
    if max_tx is not None:
        conditions.append(TileModel.tx <= max_tx)
    if min_ty is not None:
        conditions.append(TileModel.ty >= min_ty)
    if max_ty is not None:
        conditions.append(TileModel.ty <= max_ty)

    result = await db.execute(select(TileModel).where(and_(*conditions)))
    tiles = result.scalars().all()
    return [_to_schema(t) for t in tiles]


async def update_tile(db: AsyncSession, tile_id: UUID, tile_update: TileUpdate) -> Tile | None:
    """Update a tile. Returns None if tile not found."""
    result = await db.execute(select(TileModel).where(TileModel.id == tile_id))
    tile = result.scalar_one_or_none()
    if tile is None:
        return None

    if tile_update.terrain_data is not None:
        tile.terrain_data = tile_update.terrain_data.model_dump()
    if tile_update.features is not None:
        tile.features = tile_update.features.model_dump()
    tile.version += 1

    await db.commit()
    await db.refresh(tile)
    return _to_schema(tile)


async def get_or_create_tile(db: AsyncSession, world_id: UUID, tx: int, ty: int) -> tuple[Tile, bool]:
    """Get a tile by coordinates, creating it if it doesn't exist.

    Returns a tuple of (tile, created) where created is True if a new tile was made.
    """
    tile = await get_tile_by_coords(db, world_id, tx, ty)
    if tile is not None:
        return tile, False
    return await create_tile(db, TileCreate(world_id=world_id, tx=tx, ty=ty)), True


def _to_schema(tile: TileModel) -> Tile:
    """Convert SQLAlchemy model to Pydantic schema."""
    return Tile(
        id=tile.id,
        world_id=tile.world_id,
        tx=tile.tx,
        ty=tile.ty,
        terrain_data=TerrainData.model_validate(tile.terrain_data)
        if tile.terrain_data
        else TerrainData(),
        features=TileFeatures.model_validate(tile.features) if tile.features else TileFeatures(),
        created_at=_ensure_utc(tile.created_at),
        updated_at=_ensure_utc(tile.updated_at),
    )
