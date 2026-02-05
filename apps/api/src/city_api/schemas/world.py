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
    block_size_meters: int = Field(
        default=100,
        ge=50,
        le=300,
        description="Size of a city block in meters (50-300)",
    )
    district_size_meters: int = Field(
        default=500,
        ge=200,
        le=1000,
        description="Size of a district in meters (200-1000)",
    )
    beach_enabled: bool = Field(
        default=True,
        description="Whether to generate beaches along coastlines",
    )
    beach_width_multiplier: float = Field(
        default=1.0,
        ge=0.5,
        le=2.0,
        description="Multiplier for beach width (0.5 = narrow, 2.0 = wide)",
    )


class WorldCreate(BaseModel):
    """Request model for creating a new world."""

    name: str = Field(..., min_length=1, max_length=100)
    seed: int | None = Field(default=None, description="Random seed for generation")
    settings: WorldSettings = Field(default_factory=WorldSettings)


class WorldUpdate(BaseModel):
    """Request model for updating a world."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    settings: WorldSettings | None = Field(default=None)


class World(BaseModel):
    """A world (city map) owned by a user."""

    id: UUID
    user_id: UUID
    name: str
    seed: int
    settings: WorldSettings
    created_at: datetime

    model_config = {"from_attributes": True}
