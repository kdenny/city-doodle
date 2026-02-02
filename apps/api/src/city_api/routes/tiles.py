"""Tile CRUD endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from city_api.dependencies import get_current_user
from city_api.repositories import lock_repository, tile_repository, world_repository
from city_api.schemas import Tile, TileUpdate

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
    user_id: UUID = Depends(get_current_user),
) -> list[Tile]:
    """
    List tiles in a world.

    Can filter by exact coordinates (tx, ty) or by bounding box (min_tx, max_tx, min_ty, max_ty).
    """
    # Verify world exists and user has access
    world_data = world_repository.get(world_id)
    if world_data is None:
        logger.warning("World not found for tile list: world_id=%s user_id=%s", world_id, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"World {world_id} not found",
        )
    if world_data["user_id"] != user_id:
        logger.warning(
            "Unauthorized world access: world_id=%s owner=%s requester=%s",
            world_id,
            world_data["user_id"],
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this world",
        )

    # If exact coordinates provided, return single tile or empty list
    if tx is not None and ty is not None:
        tile = tile_repository.get_by_coords(world_id, tx, ty)
        return [tile] if tile else []

    # Otherwise, return tiles with optional bbox filter
    return tile_repository.list_by_world(
        world_id=world_id,
        min_tx=min_tx,
        max_tx=max_tx,
        min_ty=min_ty,
        max_ty=max_ty,
    )


@router.get("/tiles/{tile_id}", response_model=Tile)
async def get_tile(
    tile_id: UUID,
    user_id: UUID = Depends(get_current_user),
) -> Tile:
    """Get a tile by ID."""
    tile_data = tile_repository.get(tile_id)
    if tile_data is None:
        logger.warning("Tile not found: tile_id=%s user_id=%s", tile_id, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tile {tile_id} not found",
        )

    # Verify user has access to the world
    world_data = world_repository.get(tile_data["world_id"])
    if world_data is None or world_data["user_id"] != user_id:
        logger.warning(
            "Unauthorized tile access: tile_id=%s world_id=%s user_id=%s",
            tile_id,
            tile_data["world_id"],
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this tile",
        )

    return tile_repository._to_model(tile_data)


@router.patch("/tiles/{tile_id}", response_model=Tile)
async def update_tile(
    tile_id: UUID,
    tile_update: TileUpdate,
    user_id: UUID = Depends(get_current_user),
) -> Tile:
    """
    Update a tile.

    Requires the user to hold an active lock on the tile.
    Returns 409 Conflict if the tile is not locked or locked by another user.
    """
    tile_data = tile_repository.get(tile_id)
    if tile_data is None:
        logger.warning("Tile not found for update: tile_id=%s user_id=%s", tile_id, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tile {tile_id} not found",
        )

    # Verify user has access to the world
    world_data = world_repository.get(tile_data["world_id"])
    if world_data is None or world_data["user_id"] != user_id:
        logger.warning(
            "Unauthorized tile update: tile_id=%s world_id=%s user_id=%s",
            tile_id,
            tile_data["world_id"],
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this tile",
        )

    # Verify user holds an active lock on this tile
    lock = lock_repository.get(tile_id)
    if lock is None or lock.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tile must be locked for editing",
        )

    updated_tile = tile_repository.update(tile_id, tile_update)
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
    user_id: UUID = Depends(get_current_user),
) -> Tile:
    """
    Get a tile at the specified coordinates, creating it if it doesn't exist.

    This is the primary way to "create" tiles - they are created on-demand
    when a user navigates to a new area of the map.
    """
    # Verify world exists and user has access
    world_data = world_repository.get(world_id)
    if world_data is None:
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
    if world_data["user_id"] != user_id:
        logger.warning(
            "Unauthorized tile creation: world_id=%s owner=%s requester=%s",
            world_id,
            world_data["user_id"],
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this world",
        )

    return tile_repository.get_or_create(world_id, tx, ty)
