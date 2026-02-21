"""Tile CRUD endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from city_api.database import get_db
from city_api.dependencies import get_current_user
from city_api.repositories import job as job_repo
from city_api.repositories import lock as lock_repo
from city_api.repositories import tile as tile_repo
from city_api.repositories import world as world_repo
from city_api.schemas import JobCreate, JobType, Tile, TileCreate, TileUpdate, WorldSettings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tiles"])


@router.get("/worlds/{world_id}/tiles", response_model=list[Tile])
async def list_tiles(
    world_id: UUID,
    tx: int | None = Query(default=None, description="Filter by X coordinate"),
    ty: int | None = Query(default=None, description="Filter by Y coordinate"),
    min_tx: int | None = Query(default=None, description="Minimum X coordinate (bbox)"),
    max_tx: int | None = Query(default=None, description="Maximum X coordinate (bbox)"),
    min_ty: int | None = Query(default=None, description="Minimum Y coordinate (bbox)"),
    max_ty: int | None = Query(default=None, description="Maximum Y coordinate (bbox)"),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> list[Tile]:
    """
    List tiles in a world.

    Can filter by exact coordinates (tx, ty) or by bounding box (min_tx, max_tx, min_ty, max_ty).
    """
    # Verify world exists and user has access
    world_model = await world_repo.get_world(db, world_id)
    if world_model is None:
        logger.warning("World not found for tile list: world_id=%s user_id=%s", world_id, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"World {world_id} not found",
        )
    if world_model.user_id != user_id:
        logger.warning(
            "Unauthorized world access: world_id=%s owner=%s requester=%s",
            world_id,
            world_model.user_id,
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this world",
        )

    # If exact coordinates provided, return single tile or empty list
    if tx is not None and ty is not None:
        tile = await tile_repo.get_tile_by_coords(db, world_id, tx, ty)
        return [tile] if tile else []

    # Otherwise, return tiles with optional bbox filter
    tiles = await tile_repo.list_tiles_by_world(
        db,
        world_id=world_id,
        min_tx=min_tx,
        max_tx=max_tx,
        min_ty=min_ty,
        max_ty=max_ty,
    )
    # CITY-582 debug: log features summary per tile (remove in CITY-584)
    for t in tiles:
        has_geojson = isinstance(t.features, dict) and t.features.get("type") == "FeatureCollection"
        logger.info(
            "[Terrain] list_tiles tile_id=%s tx=%s ty=%s has_geojson=%s features_keys=%s",
            t.id, t.tx, t.ty, has_geojson,
            list(t.features.keys()) if isinstance(t.features, dict) else "N/A",
        )
    return tiles


@router.get("/tiles/{tile_id}", response_model=Tile)
async def get_tile(
    tile_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> Tile:
    """Get a tile by ID."""
    tile_model = await tile_repo.get_tile(db, tile_id)
    if tile_model is None:
        logger.warning("Tile not found: tile_id=%s user_id=%s", tile_id, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tile {tile_id} not found",
        )

    # Verify user has access to the world
    world_model = await world_repo.get_world(db, tile_model.world_id)
    if world_model is None or world_model.user_id != user_id:
        logger.warning(
            "Unauthorized tile access: tile_id=%s world_id=%s user_id=%s",
            tile_id,
            tile_model.world_id,
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this tile",
        )

    return tile_repo._to_schema(tile_model)


@router.patch("/tiles/{tile_id}", response_model=Tile)
async def update_tile(
    tile_id: UUID,
    tile_update: TileUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> Tile:
    """
    Update a tile.

    Requires the user to hold an active lock on the tile.
    Returns 409 Conflict if the tile is not locked or locked by another user.
    """
    tile_model = await tile_repo.get_tile(db, tile_id)
    if tile_model is None:
        logger.warning("Tile not found for update: tile_id=%s user_id=%s", tile_id, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tile {tile_id} not found",
        )

    # Verify user has access to the world
    world_model = await world_repo.get_world(db, tile_model.world_id)
    if world_model is None or world_model.user_id != user_id:
        logger.warning(
            "Unauthorized tile update: tile_id=%s world_id=%s user_id=%s",
            tile_id,
            tile_model.world_id,
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this tile",
        )

    # Verify user holds an active lock on this tile
    lock = await lock_repo.get_lock(db, tile_id)
    if lock is None or lock.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tile must be locked for editing",
        )

    updated_tile = await tile_repo.update_tile(db, tile_id, tile_update)
    if updated_tile is None:
        logger.error("Tile update failed unexpectedly: tile_id=%s user_id=%s", tile_id, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tile {tile_id} not found",
        )

    return updated_tile


@router.post("/worlds/{world_id}/tiles", response_model=Tile, status_code=status.HTTP_201_CREATED)
async def get_or_create_tile(
    world_id: UUID,
    tx: int = Query(..., description="Tile X coordinate"),
    ty: int = Query(..., description="Tile Y coordinate"),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> Tile:
    """
    Get a tile at the specified coordinates, creating it if it doesn't exist.

    This is the primary way to "create" tiles - they are created on-demand
    when a user navigates to a new area of the map.
    """
    # Verify world exists and user has access
    world_model = await world_repo.get_world(db, world_id)
    if world_model is None:
        logger.warning(
            "World not found for tile creation: world_id=%s tx=%s ty=%s user_id=%s",
            world_id,
            tx,
            ty,
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"World {world_id} not found",
        )
    if world_model.user_id != user_id:
        logger.warning(
            "Unauthorized tile creation: world_id=%s owner=%s requester=%s",
            world_id,
            world_model.user_id,
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this world",
        )

    # Check if tile already exists
    existing_tile = await tile_repo.get_tile_by_coords(db, world_id, tx, ty)
    if existing_tile is not None:
        return existing_tile

    # Create new tile with empty terrain (terrain_status defaults to "pending")
    tile = await tile_repo.create_tile(db, TileCreate(world_id=world_id, tx=tx, ty=ty))
    logger.info(
        "Created tile with terrain_status=pending: world_id=%s tx=%s ty=%s tile_id=%s",
        world_id, tx, ty, tile.id,
    )

    # Automatically queue a terrain_generation job for the new tile,
    # including world settings so the worker can apply them
    try:
        settings = WorldSettings.model_validate(world_model.settings or {})
        await job_repo.create_job(
            db,
            JobCreate(
                type=JobType.TERRAIN_GENERATION,
                tile_id=tile.id,
                params={
                    "world_id": str(world_id),
                    "world_seed": world_model.seed,
                    "center_tx": tx,
                    "center_ty": ty,
                    "world_settings": settings.model_dump(),
                },
            ),
            user_id=user_id,
        )
        logger.info(
            "Queued terrain_generation job for new tile: world_id=%s tx=%s ty=%s",
            world_id, tx, ty,
        )
    except Exception:
        logger.exception(
            "Failed to queue terrain_generation job: world_id=%s tx=%s ty=%s",
            world_id, tx, ty,
        )

    return tile
