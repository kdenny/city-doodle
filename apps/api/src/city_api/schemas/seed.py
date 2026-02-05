"""PlacedSeed schemas - for placed seeds on the world map."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class Position(BaseModel):
    """Position coordinates on the map."""

    x: float
    y: float


class PlacedSeedCreate(BaseModel):
    """Request model for creating a placed seed."""

    seed_type_id: str = Field(..., min_length=1, max_length=50, description="ID of the seed type")
    position: Position = Field(..., description="Position where the seed is placed")


class PlacedSeedBulkCreate(BaseModel):
    """Request model for bulk creating placed seeds."""

    seeds: list[PlacedSeedCreate] = Field(..., description="List of seeds to create")


class PlacedSeed(BaseModel):
    """A seed that has been placed on the world map."""

    id: UUID
    world_id: UUID
    seed_type_id: str
    position: Position
    placed_at: datetime

    model_config = {"from_attributes": True}
