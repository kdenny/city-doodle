"""Job models - represents background processing jobs."""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class JobType(str, Enum):
    """Types of background jobs."""

    TERRAIN_GENERATION = "terrain_generation"
    SEED_PLACEMENT = "seed_placement"
    GROWTH_SIMULATION = "growth_simulation"
    VMT_CALCULATION = "vmt_calculation"
    EXPORT_PNG = "export_png"
    EXPORT_GIF = "export_gif"


class JobStatus(str, Enum):
    """Status of a background job."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobCreate(BaseModel):
    """Request model for creating a new job."""

    type: JobType
    tile_id: UUID | None = Field(
        default=None,
        description="Target tile (if applicable)",
    )
    params: dict[str, Any] = Field(
        default_factory=dict,
        description="Job-specific parameters",
    )


class Job(BaseModel):
    """A background processing job."""

    id: UUID
    type: JobType
    status: JobStatus = JobStatus.PENDING
    tile_id: UUID | None = None
    params: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}
