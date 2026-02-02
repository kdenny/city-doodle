"""World CRUD endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from city_api.dependencies import get_current_user
from city_api.repositories import world_repository
from city_api.schemas import World, WorldCreate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/worlds", tags=["worlds"])


@router.post("", response_model=World, status_code=status.HTTP_201_CREATED)
async def create_world(
    world: WorldCreate,
    user_id: UUID = Depends(get_current_user),
) -> World:
    """
    Create a new world.

    If seed is not provided, a deterministic seed will be generated
    based on the world name and user ID.
    """
    return world_repository.create(world, user_id)


@router.get("", response_model=list[World])
async def list_worlds(
    user_id: UUID = Depends(get_current_user),
) -> list[World]:
    """List all worlds for the current user."""
    return world_repository.list_by_user(user_id)


@router.get("/{world_id}", response_model=World)
async def get_world(
    world_id: UUID,
    user_id: UUID = Depends(get_current_user),
) -> World:
    """
    Get a world by ID.

    Returns 404 if the world doesn't exist.
    Returns 403 if the world belongs to another user.
    """
    # Check if world exists at all
    world_data = world_repository.get(world_id)
    if world_data is None:
        logger.warning("World not found: world_id=%s user_id=%s", world_id, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"World {world_id} not found",
        )

    # Check ownership
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

    return world_repository._to_model(world_data)


@router.delete("/{world_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_world(
    world_id: UUID,
    user_id: UUID = Depends(get_current_user),
) -> None:
    """
    Soft delete a world.

    Returns 404 if the world doesn't exist.
    Returns 403 if the world belongs to another user.
    """
    # Check if world exists at all
    world_data = world_repository.get(world_id)
    if world_data is None:
        logger.warning("World not found for delete: world_id=%s user_id=%s", world_id, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"World {world_id} not found",
        )

    # Check ownership
    if world_data["user_id"] != user_id:
        logger.warning(
            "Unauthorized world delete: world_id=%s owner=%s requester=%s",
            world_id,
            world_data["user_id"],
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this world",
        )

    world_repository.delete(world_id, user_id)
