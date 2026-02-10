"""City schemas - represents cities within a world."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class CityClassification(StrEnum):
    """Classification of a city within a world."""

    CORE = "core"
    SUBURB = "suburb"
    TOWN = "town"


class CityCreate(BaseModel):
    """Request model for creating a new city."""

    world_id: UUID = Field(default=None, description="Set from path parameter")
    name: str = Field(..., min_length=1, max_length=255, description="Display name for the city")
    classification: CityClassification
    boundary: dict[str, Any] = Field(
        ...,
        description="GeoJSON polygon for the city boundary",
    )
    established: int | None = Field(
        default=None,
        description="Year the city was established",
    )


class CityUpdate(BaseModel):
    """Request model for updating a city."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    classification: CityClassification | None = None
    boundary: dict[str, Any] | None = None
    established: int | None = None


class CityResponse(BaseModel):
    """A city within a world."""

    id: UUID
    world_id: UUID
    name: str
    classification: CityClassification
    boundary: dict[str, Any] = Field(
        ...,
        description="GeoJSON polygon for the city boundary",
    )
    established: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
