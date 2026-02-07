"""World model for storing city/map instances."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from city_api.database import Base, JSONVariant

if TYPE_CHECKING:
    from city_api.models.district import District
    from city_api.models.neighborhood import Neighborhood
    from city_api.models.poi import POI
    from city_api.models.road_network import RoadEdge, RoadNode
    from city_api.models.seed import PlacedSeed
    from city_api.models.tile import Tile
    from city_api.models.transit import TransitLine, TransitStation


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
    transit_stations: Mapped[list["TransitStation"]] = relationship(
        "TransitStation", back_populates="world", cascade="all, delete-orphan"
    )
    transit_lines: Mapped[list["TransitLine"]] = relationship(
        "TransitLine", back_populates="world", cascade="all, delete-orphan"
    )
    neighborhoods: Mapped[list["Neighborhood"]] = relationship(
        "Neighborhood", back_populates="world", cascade="all, delete-orphan"
    )
    pois: Mapped[list["POI"]] = relationship(
        "POI", back_populates="world", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_worlds_user_id", "user_id"),)
