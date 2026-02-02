"""World model for storing city/map instances."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from city_api.database import Base

if TYPE_CHECKING:
    from city_api.models.tile import Tile


class World(Base):
    """A world/map instance containing tiles."""

    __tablename__ = "worlds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    tiles: Mapped[list["Tile"]] = relationship("Tile", back_populates="world")
