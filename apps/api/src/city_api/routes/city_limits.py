"""CityLimits CRUD endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from city_api.database import get_db
from city_api.dependencies import get_current_user
from city_api.repositories import city_limits as city_limits_repo
from city_api.repositories import world as world_repo
from city_api.schemas.city_limits import CityLimits, CityLimitsCreate, CityLimitsUpdate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["city_limits"])


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


@router.get("/worlds/{world_id}/city-limits", response_model=CityLimits | None)
async def get_city_limits(
    world_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> CityLimits | None:
    """Get the city limits for a world."""
    await _verify_world_ownership(db, world_id, user_id)
    return await city_limits_repo.get_by_world(db, world_id)


@router.put(
    "/worlds/{world_id}/city-limits",
    response_model=CityLimits,
    status_code=status.HTTP_200_OK,
)
async def upsert_city_limits(
    world_id: UUID,
    data: CityLimitsCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> CityLimits:
    """Create or replace the city limits for a world."""
    await _verify_world_ownership(db, world_id, user_id)
    data.world_id = world_id
    return await city_limits_repo.upsert(db, data)


@router.patch(
    "/worlds/{world_id}/city-limits",
    response_model=CityLimits,
)
async def update_city_limits(
    world_id: UUID,
    data: CityLimitsUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> CityLimits:
    """Update the city limits for a world."""
    await _verify_world_ownership(db, world_id, user_id)
    updated = await city_limits_repo.update(db, world_id, data)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="City limits not found for this world",
        )
    return updated


@router.delete("/worlds/{world_id}/city-limits", status_code=status.HTTP_204_NO_CONTENT)
async def delete_city_limits(
    world_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> None:
    """Delete the city limits for a world."""
    await _verify_world_ownership(db, world_id, user_id)
    await city_limits_repo.delete_by_world(db, world_id)
