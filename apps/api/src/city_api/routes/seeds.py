"""Placed seeds CRUD endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from city_api.database import get_db
from city_api.dependencies import get_current_user
from city_api.repositories import seed as seed_repo
from city_api.repositories import world as world_repo
from city_api.schemas import PlacedSeed, PlacedSeedBulkCreate, PlacedSeedCreate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["seeds"])


async def _verify_world_ownership(
    db: AsyncSession, world_id: UUID, user_id: UUID
) -> None:
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


@router.get("/worlds/{world_id}/seeds", response_model=list[PlacedSeed])
async def list_seeds(
    world_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> list[PlacedSeed]:
    """List all placed seeds in a world."""
    await _verify_world_ownership(db, world_id, user_id)
    return await seed_repo.list_seeds_by_world(db, world_id)


@router.post(
    "/worlds/{world_id}/seeds",
    response_model=PlacedSeed,
    status_code=status.HTTP_201_CREATED,
)
async def create_seed(
    world_id: UUID,
    seed_create: PlacedSeedCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> PlacedSeed:
    """Create a new placed seed in a world."""
    await _verify_world_ownership(db, world_id, user_id)
    return await seed_repo.create_seed(db, world_id, seed_create)


@router.post(
    "/worlds/{world_id}/seeds/bulk",
    response_model=list[PlacedSeed],
    status_code=status.HTTP_201_CREATED,
)
async def create_seeds_bulk(
    world_id: UUID,
    bulk_create: PlacedSeedBulkCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> list[PlacedSeed]:
    """Create multiple placed seeds in a single request."""
    await _verify_world_ownership(db, world_id, user_id)
    return await seed_repo.create_seeds_bulk(db, world_id, bulk_create.seeds)


@router.delete("/seeds/{seed_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_seed(
    seed_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> None:
    """Delete a placed seed."""
    # First get the seed to verify ownership
    seed = await seed_repo.get_seed(db, seed_id)
    if seed is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seed {seed_id} not found",
        )

    # Verify world ownership
    await _verify_world_ownership(db, seed.world_id, user_id)

    await seed_repo.delete_seed(db, seed_id)


@router.delete("/worlds/{world_id}/seeds", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_seeds(
    world_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> None:
    """Delete all placed seeds in a world."""
    await _verify_world_ownership(db, world_id, user_id)
    await seed_repo.delete_all_seeds_in_world(db, world_id)
