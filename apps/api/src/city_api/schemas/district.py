"""District schemas - represents zoning districts in a world."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class DistrictType(StrEnum):
    """Types of zoning districts."""

    RESIDENTIAL_LOW = "residential_low"
    RESIDENTIAL_MED = "residential_med"
    RESIDENTIAL_HIGH = "residential_high"
    COMMERCIAL = "commercial"
    INDUSTRIAL = "industrial"
    MIXED_USE = "mixed_use"
    PARK = "park"
    CIVIC = "civic"
    TRANSIT = "transit"


class DistrictProperties(BaseModel):
    """Properties specific to a district."""

    density: float = Field(
        default=1.0,
        ge=0.0,
        le=10.0,
        description="Development density multiplier",
    )
    max_height: int = Field(
        default=4,
        ge=1,
        le=100,
        description="Maximum building height in stories",
    )
    transit_access: bool = Field(
        default=False,
        description="Whether district has transit access",
    )


class DistrictCreate(BaseModel):
    """Request model for creating a new district."""

    world_id: UUID
    type: DistrictType
    name: str | None = Field(default=None, description="Display name for the district")
    geometry: dict[str, Any] = Field(
        ...,
        description="GeoJSON geometry for the district boundary",
    )
    density: float = Field(default=1.0, ge=0.0, le=10.0)
    max_height: int = Field(default=4, ge=1, le=100)
    transit_access: bool = False
    historic: bool = Field(
        default=False,
        description="Historic preservation - prevents redevelopment during growth",
    )


class DistrictUpdate(BaseModel):
    """Request model for updating a district."""

    type: DistrictType | None = None
    name: str | None = None
    geometry: dict[str, Any] | None = None
    density: float | None = Field(default=None, ge=0.0, le=10.0)
    max_height: int | None = Field(default=None, ge=1, le=100)
    transit_access: bool | None = None
    historic: bool | None = None


class District(BaseModel):
    """A zoning district in a world."""

    id: UUID
    world_id: UUID
    type: DistrictType
    name: str | None = None
    geometry: dict[str, Any] = Field(
        ...,
        description="GeoJSON geometry for the district boundary",
    )
    density: float
    max_height: int
    transit_access: bool
    historic: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DistrictBulkCreate(BaseModel):
    """Request model for creating multiple districts."""

    districts: list[DistrictCreate]


# Legacy compatibility - flatten properties for simpler API
DistrictProperties = DistrictProperties  # Keep for backward compatibility
