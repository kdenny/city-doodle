"""Neighborhood CRUD endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from city_api.database import get_db
from city_api.dependencies import get_current_user
from city_api.repositories import neighborhood as neighborhood_repo
from city_api.repositories import world as world_repo
from city_api.schemas.neighborhood import (
    Neighborhood,
    NeighborhoodBulkCreate,
    NeighborhoodCreate,
    NeighborhoodUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["neighborhoods"])


async def _verify_world_ownership(db: AsyncSession, world_id: UUID, user_id: UUID) -> None:
    """Verify that the user owns the world. Raises HTTPException if not."""
    world = await world_repo.get_world(db, world_id)
    if world is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"World {world_id} not found",
        )
    if world.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this world",
        )


# ============================================================================
# Neighborhood CRUD
# ============================================================================


@router.get("/worlds/{world_id}/neighborhoods", response_model=list[Neighborhood])
async def list_neighborhoods(
    world_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> list[Neighborhood]:
    """List all neighborhoods in a world."""
    await _verify_world_ownership(db, world_id, user_id)
    return await neighborhood_repo.list_neighborhoods_by_world(db, world_id)


@router.post(
    "/worlds/{world_id}/neighborhoods",
    response_model=Neighborhood,
    status_code=status.HTTP_201_CREATED,
)
async def create_neighborhood(
    world_id: UUID,
    neighborhood_create: NeighborhoodCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> Neighborhood:
    """Create a new neighborhood."""
    await _verify_world_ownership(db, world_id, user_id)
    # Override world_id from path
    neighborhood_create.world_id = world_id
    return await neighborhood_repo.create_neighborhood(db, neighborhood_create)


@router.post(
    "/worlds/{world_id}/neighborhoods/bulk",
    response_model=list[Neighborhood],
    status_code=status.HTTP_201_CREATED,
)
async def create_neighborhoods_bulk(
    world_id: UUID,
    bulk_create: NeighborhoodBulkCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> list[Neighborhood]:
    """Create multiple neighborhoods in a single request."""
    await _verify_world_ownership(db, world_id, user_id)
    # Override world_id from path
    for n in bulk_create.neighborhoods:
        n.world_id = world_id
    return await neighborhood_repo.create_neighborhoods_bulk(db, bulk_create.neighborhoods)


@router.get("/neighborhoods/{neighborhood_id}", response_model=Neighborhood)
async def get_neighborhood(
    neighborhood_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> Neighborhood:
    """Get a neighborhood by ID."""
    neighborhood = await neighborhood_repo.get_neighborhood(db, neighborhood_id)
    if neighborhood is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Neighborhood {neighborhood_id} not found",
        )
    await _verify_world_ownership(db, neighborhood.world_id, user_id)
    return neighborhood


@router.patch("/neighborhoods/{neighborhood_id}", response_model=Neighborhood)
async def update_neighborhood(
    neighborhood_id: UUID,
    neighborhood_update: NeighborhoodUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> Neighborhood:
    """Update a neighborhood."""
    neighborhood = await neighborhood_repo.get_neighborhood(db, neighborhood_id)
    if neighborhood is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Neighborhood {neighborhood_id} not found",
        )
    await _verify_world_ownership(db, neighborhood.world_id, user_id)

    updated = await neighborhood_repo.update_neighborhood(db, neighborhood_id, neighborhood_update)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Neighborhood {neighborhood_id} not found",
        )
    return updated


@router.delete("/neighborhoods/{neighborhood_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_neighborhood(
    neighborhood_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> None:
    """Delete a neighborhood."""
    neighborhood = await neighborhood_repo.get_neighborhood(db, neighborhood_id)
    if neighborhood is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Neighborhood {neighborhood_id} not found",
        )
    await _verify_world_ownership(db, neighborhood.world_id, user_id)
    await neighborhood_repo.delete_neighborhood(db, neighborhood_id)


@router.delete("/worlds/{world_id}/neighborhoods", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_neighborhoods(
    world_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> None:
    """Delete all neighborhoods in a world."""
    await _verify_world_ownership(db, world_id, user_id)
    await neighborhood_repo.clear_neighborhoods(db, world_id)
