"""Job model for background task queue."""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from city_api.database import Base, JSONVariant


class JobStatus(StrEnum):
    """Job status values."""

    PENDING = "pending"
    RUNNING = "running"
    CLAIMED = "claimed"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobType(StrEnum):
    """Job type values."""

    TERRAIN_GENERATION = "terrain_generation"
    SEED_PLACEMENT = "seed_placement"
    GROWTH_SIMULATION = "growth_simulation"
    VMT_CALCULATION = "vmt_calculation"
    CITY_GROWTH = "city_growth"
    EXPORT_PNG = "export_png"
    EXPORT_GIF = "export_gif"


class Job(Base):
    """Background job for worker processing."""

    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=JobStatus.PENDING.value)
    tile_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("tiles.id", ondelete="SET NULL"), nullable=True
    )
    params: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    result: Mapped[dict | None] = mapped_column(JSONVariant, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_jobs_status", "status"),
        Index("ix_jobs_type_status", "type", "status"),
        Index("ix_jobs_tile_id", "tile_id"),
        Index("ix_jobs_user_id", "user_id"),
    )
