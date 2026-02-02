"""District schemas - represents zoning districts on tiles."""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class DistrictType(str, Enum):
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

    tile_id: UUID
    type: DistrictType
    geometry: dict[str, Any] = Field(
        ...,
        description="GeoJSON geometry for the district boundary",
    )
    properties: DistrictProperties = Field(default_factory=DistrictProperties)
    historic: bool = Field(
        default=False,
        description="Historic preservation - prevents redevelopment during growth",
    )


class District(BaseModel):
    """A zoning district placed on a tile."""

    id: UUID
    tile_id: UUID
    type: DistrictType
    geometry: dict[str, Any] = Field(
        ...,
        description="GeoJSON geometry for the district boundary",
    )
    properties: DistrictProperties = Field(default_factory=DistrictProperties)
    historic: bool = Field(
        default=False,
        description="Historic preservation - prevents redevelopment during growth",
    )
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
