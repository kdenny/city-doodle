"""Neighborhood model for persisting named areas."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from city_api.database import Base, JSONVariant

if TYPE_CHECKING:
    from city_api.models.world import World


class Neighborhood(Base):
    """A named neighborhood area in a world.

    Neighborhoods are distinct from districts - they represent named areas
    that can span multiple districts. They're used for labeling and identity,
    not land-use zoning.
    """

    __tablename__ = "neighborhoods"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    world_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False
    )
    # Name for the neighborhood (e.g., "Arts Quarter", "Riverside")
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # GeoJSON geometry for the neighborhood boundary (Polygon)
    geometry: Mapped[dict] = mapped_column(JSONVariant, nullable=False)
    # Optional styling
    label_color: Mapped[str | None] = mapped_column(String(7), nullable=True)  # Hex color
    accent_color: Mapped[str | None] = mapped_column(String(7), nullable=True)  # Hex color
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
    world: Mapped["World"] = relationship("World", back_populates="neighborhoods")

    __table_args__ = (
        Index("ix_neighborhoods_world_id", "world_id"),
    )
