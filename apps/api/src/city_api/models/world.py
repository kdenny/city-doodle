"""World model for storing city/map instances."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from city_api.database import Base, JSONVariant

if TYPE_CHECKING:
    from city_api.models.district import District
    from city_api.models.road_network import RoadEdge, RoadNode
    from city_api.models.seed import PlacedSeed
    from city_api.models.tile import Tile


class World(Base):
    """A world/map instance containing tiles."""

    __tablename__ = "worlds"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)
    settings: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    tiles: Mapped[list["Tile"]] = relationship("Tile", back_populates="world")
    placed_seeds: Mapped[list["PlacedSeed"]] = relationship(
        "PlacedSeed", back_populates="world", cascade="all, delete-orphan"
    )
    districts: Mapped[list["District"]] = relationship(
        "District", back_populates="world", cascade="all, delete-orphan"
    )
    road_nodes: Mapped[list["RoadNode"]] = relationship(
        "RoadNode", back_populates="world", cascade="all, delete-orphan"
    )
    road_edges: Mapped[list["RoadEdge"]] = relationship(
        "RoadEdge", back_populates="world", cascade="all, delete-orphan"
    )
