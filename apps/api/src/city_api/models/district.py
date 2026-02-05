"""District model for persisting zoning districts."""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Uuid, func
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from city_api.database import Base, JSONVariant

if TYPE_CHECKING:
    from city_api.models.world import World


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


class District(Base):
    """A zoning district in a world."""

    __tablename__ = "districts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    world_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[DistrictType] = mapped_column(
        SQLEnum(DistrictType, name="district_type", create_constraint=True),
        nullable=False,
    )
    # Name for labels
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # GeoJSON geometry for the district boundary
    geometry: Mapped[dict] = mapped_column(JSONVariant, nullable=False)
    # Development properties
    density: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    max_height: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    transit_access: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Historic preservation flag
    historic: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    world: Mapped["World"] = relationship("World", back_populates="districts")

    __table_args__ = (
        Index("ix_districts_world_id", "world_id"),
        Index("ix_districts_type", "type"),
        Index("ix_districts_historic", "historic"),
    )


# Default district properties by type
DISTRICT_TYPE_DEFAULTS: dict[DistrictType, dict] = {
    DistrictType.RESIDENTIAL_LOW: {"density": 1.0, "max_height": 3},
    DistrictType.RESIDENTIAL_MED: {"density": 3.0, "max_height": 8},
    DistrictType.RESIDENTIAL_HIGH: {"density": 7.0, "max_height": 30},
    DistrictType.COMMERCIAL: {"density": 5.0, "max_height": 15},
    DistrictType.INDUSTRIAL: {"density": 2.0, "max_height": 4},
    DistrictType.MIXED_USE: {"density": 6.0, "max_height": 20},
    DistrictType.PARK: {"density": 0.1, "max_height": 1},
    DistrictType.CIVIC: {"density": 2.0, "max_height": 6},
    DistrictType.TRANSIT: {"density": 4.0, "max_height": 10},
}
