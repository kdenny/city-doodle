"""City CRUD endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from city_api.database import get_db
from city_api.dependencies import get_current_user
from city_api.repositories import city as city_repo
from city_api.repositories import world as world_repo
from city_api.schemas.city import CityCreate, CityResponse, CityUpdate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["cities"])


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
# City CRUD
# ============================================================================


@router.get("/worlds/{world_id}/cities", response_model=list[CityResponse])
async def list_cities(
    world_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> list[CityResponse]:
    """List all cities in a world."""
    await _verify_world_ownership(db, world_id, user_id)
    return await city_repo.list_cities_by_world(db, world_id)


@router.post(
    "/worlds/{world_id}/cities",
    response_model=CityResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_city(
    world_id: UUID,
    city_create: CityCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> CityResponse:
    """Create a new city.

    Enforces a maximum of 3 core cities per world.
    """
    await _verify_world_ownership(db, world_id, user_id)
    # Override world_id from path
    city_create.world_id = world_id
    try:
        return await city_repo.create_city(db, city_create)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.get("/cities/{city_id}", response_model=CityResponse)
async def get_city(
    city_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> CityResponse:
    """Get a city by ID."""
    city = await city_repo.get_city(db, city_id)
    if city is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"City {city_id} not found",
        )
    await _verify_world_ownership(db, city.world_id, user_id)
    return city


@router.patch("/cities/{city_id}", response_model=CityResponse)
async def update_city(
    city_id: UUID,
    city_update: CityUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> CityResponse:
    """Update a city."""
    city = await city_repo.get_city(db, city_id)
    if city is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"City {city_id} not found",
        )
    await _verify_world_ownership(db, city.world_id, user_id)

    try:
        updated = await city_repo.update_city(db, city_id, city_update)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"City {city_id} not found",
        )
    return updated


@router.delete("/cities/{city_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_city(
    city_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> None:
    """Delete a city.

    Cascade: neighborhoods are deleted, districts are unlinked (SET NULL).
    """
    city = await city_repo.get_city(db, city_id)
    if city is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"City {city_id} not found",
        )
    await _verify_world_ownership(db, city.world_id, user_id)
    await city_repo.delete_city(db, city_id)
