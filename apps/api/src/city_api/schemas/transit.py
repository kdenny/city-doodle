"""Transit schemas - stations, lines, and segments."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


class StationType(StrEnum):
    """Types of transit stations."""

    SUBWAY = "subway"
    RAIL = "rail"


class LineType(StrEnum):
    """Types of transit lines."""

    SUBWAY = "subway"
    RAIL = "rail"


class Point(BaseModel):
    """A 2D point in world coordinates."""

    x: float
    y: float


# ============================================================================
# Transit Station Schemas
# ============================================================================


class TransitStationCreate(BaseModel):
    """Request model for creating a transit station."""

    world_id: UUID
    district_id: UUID = Field(..., description="District where the station is located (required)")
    station_type: StationType
    name: str = Field(..., min_length=1, max_length=255)
    position_x: float
    position_y: float
    is_terminus: bool = False


class TransitStationUpdate(BaseModel):
    """Request model for updating a transit station."""

    district_id: UUID | None = None
    station_type: StationType | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    position_x: float | None = None
    position_y: float | None = None
    is_terminus: bool | None = None


class TransitStation(BaseModel):
    """A transit station response."""

    id: UUID
    world_id: UUID
    district_id: UUID
    station_type: StationType
    name: str
    position_x: float
    position_y: float
    is_terminus: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransitStationBulkCreate(BaseModel):
    """Request model for creating multiple stations."""

    stations: list[TransitStationCreate]


# ============================================================================
# Transit Line Schemas
# ============================================================================


class TransitLineCreate(BaseModel):
    """Request model for creating a transit line."""

    world_id: UUID
    line_type: LineType
    name: str = Field(..., min_length=1, max_length=255)
    color: str = Field(default="#FF0000", pattern=r"^#[0-9A-Fa-f]{6}$")
    is_auto_generated: bool = False


class TransitLineUpdate(BaseModel):
    """Request model for updating a transit line."""

    line_type: LineType | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    is_auto_generated: bool | None = None


class TransitLine(BaseModel):
    """A transit line response."""

    id: UUID
    world_id: UUID
    line_type: LineType
    name: str
    color: str
    is_auto_generated: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransitLineBulkCreate(BaseModel):
    """Request model for creating multiple lines."""

    lines: list[TransitLineCreate]


# ============================================================================
# Transit Line Segment Schemas
# ============================================================================


class TransitLineSegmentCreate(BaseModel):
    """Request model for creating a line segment."""

    line_id: UUID
    from_station_id: UUID
    to_station_id: UUID
    geometry: list[Point] = Field(default_factory=list)
    is_underground: bool = False
    order_in_line: int = Field(..., ge=0)

    @model_validator(mode="after")
    def check_no_self_reference(self) -> "TransitLineSegmentCreate":
        if self.from_station_id == self.to_station_id:
            raise ValueError("from_station_id and to_station_id must be different")
        return self


class TransitLineSegmentUpdate(BaseModel):
    """Request model for updating a line segment."""

    from_station_id: UUID | None = None
    to_station_id: UUID | None = None
    geometry: list[Point] | None = None
    is_underground: bool | None = None
    order_in_line: int | None = Field(default=None, ge=0)


class TransitLineSegment(BaseModel):
    """A transit line segment response."""

    id: UUID
    line_id: UUID
    from_station_id: UUID
    to_station_id: UUID
    geometry: list[Point] = Field(default_factory=list)
    is_underground: bool
    order_in_line: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("geometry", mode="before")
    @classmethod
    def convert_geometry(cls, v: list) -> list[Point]:
        """Convert list of dicts to list of Points."""
        if v and len(v) > 0 and isinstance(v[0], dict):
            return [Point(**p) for p in v]
        return v


class TransitLineSegmentBulkCreate(BaseModel):
    """Request model for creating multiple segments."""

    segments: list[TransitLineSegmentCreate]


# ============================================================================
# Aggregate Schemas
# ============================================================================


class TransitLineWithSegments(BaseModel):
    """A transit line with all its segments."""

    id: UUID
    world_id: UUID
    line_type: LineType
    name: str
    color: str
    is_auto_generated: bool
    segments: list[TransitLineSegment]
    created_at: datetime
    updated_at: datetime


class TransitNetwork(BaseModel):
    """Complete transit network for a world."""

    world_id: UUID
    stations: list[TransitStation]
    lines: list[TransitLineWithSegments]


class TransitNetworkStats(BaseModel):
    """Statistics about a transit network."""

    world_id: UUID
    total_stations: int
    total_lines: int
    total_segments: int
    stations_by_type: dict[str, int]
    lines_by_type: dict[str, int]
