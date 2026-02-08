"""CityLimits schemas - represents the city boundary."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class CityLimitsCreate(BaseModel):
    """Request model for creating/updating city limits."""

    world_id: UUID
    name: str = Field(..., min_length=1, max_length=255, description="City name")
    boundary: dict[str, Any] = Field(
        ...,
        description="GeoJSON geometry for the city boundary polygon",
    )
    established: int | None = Field(
        default=None,
        description="Year the city was established",
    )


class CityLimitsUpdate(BaseModel):
    """Request model for updating city limits."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    boundary: dict[str, Any] | None = None
    established: int | None = None


class CityLimits(BaseModel):
    """The city limits boundary for a world."""

    id: UUID
    world_id: UUID
    name: str
    boundary: dict[str, Any]
    established: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
