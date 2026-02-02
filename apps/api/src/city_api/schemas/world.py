"""World schema - represents a user's city map."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class WorldSettings(BaseModel):
    """Configuration settings for a world."""

    grid_organic: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="0 = strict grid, 1 = fully organic street layout",
    )
    sprawl_compact: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="0 = sprawling suburbs, 1 = dense urban core",
    )
    historic_modern: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="0 = historic preservation focus, 1 = modern redevelopment",
    )
    transit_car: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="0 = transit-oriented, 1 = car-dependent",
    )


class WorldCreate(BaseModel):
    """Request model for creating a new world."""

    name: str = Field(..., min_length=1, max_length=100)
    seed: int | None = Field(default=None, description="Random seed for generation")
    settings: WorldSettings = Field(default_factory=WorldSettings)


class World(BaseModel):
    """A world (city map) owned by a user."""

    id: UUID
    user_id: UUID
    name: str
    seed: int
    settings: WorldSettings
    created_at: datetime

    model_config = {"from_attributes": True}
