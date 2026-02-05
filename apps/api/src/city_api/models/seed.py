"""PlacedSeed model for persisting user-placed seeds on the map."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Float, ForeignKey, Index, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from city_api.database import Base, JSONVariant

if TYPE_CHECKING:
    from city_api.models.world import World


class PlacedSeed(Base):
    """A seed placed by a user on the world map.

    For park seeds (seed_type_id starting with "park_"), the metadata field
    contains ParkMetadata-compatible JSON with size, name, and feature flags.
    """

    __tablename__ = "placed_seeds"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    world_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False
    )
    seed_type_id: Mapped[str] = mapped_column(String(50), nullable=False)
    position_x: Mapped[float] = mapped_column(Float, nullable=False)
    position_y: Mapped[float] = mapped_column(Float, nullable=False)
    placed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    seed_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSONVariant, nullable=True, default=None
    )

    world: Mapped["World"] = relationship("World", back_populates="placed_seeds")

    __table_args__ = (Index("ix_placed_seeds_world_id", "world_id"),)
