"""POI schemas - represents Points of Interest in a world."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field


class POIType(StrEnum):
    """Types of Points of Interest.

    These match the frontend POI types.
    """

    HOSPITAL = "hospital"
    SCHOOL = "school"
    UNIVERSITY = "university"
    PARK = "park"
    TRANSIT = "transit"
    SHOPPING = "shopping"
    CIVIC = "civic"
    INDUSTRIAL = "industrial"


class POICreate(BaseModel):
    """Request model for creating a new POI."""

    world_id: UUID
    type: POIType
    name: str = Field(..., min_length=1, max_length=255, description="Display name for the POI")
    position_x: float = Field(..., description="X coordinate in world space")
    position_y: float = Field(..., description="Y coordinate in world space")


class POIUpdate(BaseModel):
    """Request model for updating a POI."""

    type: POIType | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    position_x: float | None = None
    position_y: float | None = None


class POI(BaseModel):
    """A Point of Interest in a world."""

    id: UUID
    world_id: UUID
    type: POIType
    name: str
    position_x: float
    position_y: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class POIBulkCreate(BaseModel):
    """Request model for creating multiple POIs."""

    pois: list[POICreate]
