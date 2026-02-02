"""Tile and TileLock models for map grid cells."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from city_api.database import Base, JSONVariant

if TYPE_CHECKING:
    from city_api.models.world import World


class Tile(Base):
    """A single tile in the world grid."""

    __tablename__ = "tiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    world_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False
    )
    tx: Mapped[int] = mapped_column(Integer, nullable=False)
    ty: Mapped[int] = mapped_column(Integer, nullable=False)
    terrain_data: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    features: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    world: Mapped["World"] = relationship("World", back_populates="tiles")
    lock: Mapped["TileLock | None"] = relationship("TileLock", back_populates="tile", uselist=False)

    __table_args__ = (
        Index("ix_tiles_world_id", "world_id"),
        Index("ix_tiles_world_coords", "world_id", "tx", "ty", unique=True),
    )


class TileLock(Base):
    """Lock on a tile for concurrent editing control."""

    __tablename__ = "tile_locks"

    tile_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("tiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    locked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    tile: Mapped["Tile"] = relationship("Tile", back_populates="lock")

    __table_args__ = (Index("ix_tile_locks_expires_at", "expires_at"),)
