"""POI CRUD endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from city_api.database import get_db
from city_api.dependencies import get_current_user
from city_api.repositories import poi as poi_repo
from city_api.repositories import world as world_repo
from city_api.schemas.poi import (
    POI,
    POIBulkCreate,
    POICreate,
    POIType,
    POIUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["pois"])


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
# POI CRUD
# ============================================================================


@router.get("/worlds/{world_id}/pois", response_model=list[POI])
async def list_pois(
    world_id: UUID,
    poi_type: POIType | None = Query(default=None, description="Filter by POI type"),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> list[POI]:
    """List all POIs in a world, optionally filtered by type."""
    await _verify_world_ownership(db, world_id, user_id)
    type_filter = poi_type.value if poi_type else None
    return await poi_repo.list_pois_by_world(db, world_id, poi_type=type_filter)


@router.post(
    "/worlds/{world_id}/pois",
    response_model=POI,
    status_code=status.HTTP_201_CREATED,
)
async def create_poi(
    world_id: UUID,
    poi_create: POICreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> POI:
    """Create a new POI."""
    await _verify_world_ownership(db, world_id, user_id)
    # Override world_id from path
    poi_create.world_id = world_id
    return await poi_repo.create_poi(db, poi_create)


@router.post(
    "/worlds/{world_id}/pois/bulk",
    response_model=list[POI],
    status_code=status.HTTP_201_CREATED,
)
async def create_pois_bulk(
    world_id: UUID,
    bulk_create: POIBulkCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> list[POI]:
    """Create multiple POIs in a single request."""
    await _verify_world_ownership(db, world_id, user_id)
    # Override world_id from path
    for p in bulk_create.pois:
        p.world_id = world_id
    return await poi_repo.create_pois_bulk(db, bulk_create.pois)


@router.get("/pois/{poi_id}", response_model=POI)
async def get_poi(
    poi_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> POI:
    """Get a POI by ID."""
    poi = await poi_repo.get_poi(db, poi_id)
    if poi is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"POI {poi_id} not found",
        )
    await _verify_world_ownership(db, poi.world_id, user_id)
    return poi


@router.patch("/pois/{poi_id}", response_model=POI)
async def update_poi(
    poi_id: UUID,
    poi_update: POIUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> POI:
    """Update a POI."""
    poi = await poi_repo.get_poi(db, poi_id)
    if poi is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"POI {poi_id} not found",
        )
    await _verify_world_ownership(db, poi.world_id, user_id)

    updated = await poi_repo.update_poi(db, poi_id, poi_update)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"POI {poi_id} not found",
        )
    return updated


@router.delete("/pois/{poi_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_poi(
    poi_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> None:
    """Delete a POI."""
    poi = await poi_repo.get_poi(db, poi_id)
    if poi is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"POI {poi_id} not found",
        )
    await _verify_world_ownership(db, poi.world_id, user_id)
    await poi_repo.delete_poi(db, poi_id)


@router.delete("/worlds/{world_id}/pois", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_pois(
    world_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> None:
    """Delete all POIs in a world."""
    await _verify_world_ownership(db, world_id, user_id)
    await poi_repo.clear_pois(db, world_id)
