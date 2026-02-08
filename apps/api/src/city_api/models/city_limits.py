"""CityLimits model for persisting city boundary."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from city_api.database import Base, JSONVariant

if TYPE_CHECKING:
    from city_api.models.world import World


class CityLimits(Base):
    """The official city boundary for a world.

    Only one city limits per world (enforced by unique constraint on world_id).
    """

    __tablename__ = "city_limits"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    world_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # GeoJSON geometry for the boundary polygon
    boundary: Mapped[dict] = mapped_column(JSONVariant, nullable=False)
    # Optional year the city was established
    established: Mapped[int | None] = mapped_column(Integer, nullable=True)
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
    world: Mapped["World"] = relationship("World", back_populates="city_limits")
