"""Road network schemas - nodes (intersections) and edges (road segments)."""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class RoadClass(str, Enum):
    """Road classification for styling and routing priority."""

    HIGHWAY = "highway"
    ARTERIAL = "arterial"
    COLLECTOR = "collector"
    LOCAL = "local"
    ALLEY = "alley"


class NodeType(str, Enum):
    """Node types for intersection handling."""

    INTERSECTION = "intersection"
    ENDPOINT = "endpoint"
    ROUNDABOUT = "roundabout"
    INTERCHANGE = "interchange"


class Point(BaseModel):
    """A 2D point in world coordinates."""

    x: float
    y: float


# ============================================================================
# Road Node Schemas
# ============================================================================


class RoadNodeCreate(BaseModel):
    """Request model for creating a road node."""

    world_id: UUID
    position: Point
    node_type: NodeType = NodeType.INTERSECTION
    name: str | None = None


class RoadNodeUpdate(BaseModel):
    """Request model for updating a road node."""

    position: Point | None = None
    node_type: NodeType | None = None
    name: str | None = None


class RoadNode(BaseModel):
    """A node in the road network (intersection or endpoint)."""

    id: UUID
    world_id: UUID
    position: Point
    node_type: NodeType
    name: str | None = None
    connected_edges: list[UUID] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("position", mode="before")
    @classmethod
    def convert_position(cls, v: dict | Point) -> Point:
        """Convert dict position to Point model."""
        if isinstance(v, dict):
            return Point(**v)
        return v


# ============================================================================
# Road Edge Schemas
# ============================================================================


class RoadEdgeCreate(BaseModel):
    """Request model for creating a road edge."""

    world_id: UUID
    from_node_id: UUID
    to_node_id: UUID
    road_class: RoadClass = RoadClass.LOCAL
    geometry: list[Point] = Field(default_factory=list)
    speed_limit: int | None = None
    name: str | None = None
    is_one_way: bool = False
    lanes: int = 2
    district_id: UUID | None = None


class RoadEdgeUpdate(BaseModel):
    """Request model for updating a road edge."""

    road_class: RoadClass | None = None
    geometry: list[Point] | None = None
    speed_limit: int | None = None
    name: str | None = None
    is_one_way: bool | None = None
    lanes: int | None = None


class RoadEdge(BaseModel):
    """An edge in the road network (road segment)."""

    id: UUID
    world_id: UUID
    from_node_id: UUID
    to_node_id: UUID
    road_class: RoadClass
    geometry: list[Point] = Field(default_factory=list)
    length_meters: float
    speed_limit: int | None = None
    name: str | None = None
    is_one_way: bool
    lanes: int
    district_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("geometry", mode="before")
    @classmethod
    def convert_geometry(cls, v: list) -> list[Point]:
        """Convert list of dicts to list of Points."""
        if v and isinstance(v[0], dict):
            return [Point(**p) for p in v]
        return v


# ============================================================================
# Road Network Aggregate Schemas
# ============================================================================


class RoadNetwork(BaseModel):
    """Complete road network for a world."""

    world_id: UUID
    nodes: list[RoadNode]
    edges: list[RoadEdge]


class RoadNetworkStats(BaseModel):
    """Statistics about a road network."""

    world_id: UUID
    total_nodes: int
    total_edges: int
    total_length_meters: float
    edges_by_class: dict[str, int]
    connectivity_score: float = Field(
        description="Ratio of connected components (1.0 = fully connected)"
    )


# ============================================================================
# Bulk Operations
# ============================================================================


class RoadNodeBulkCreate(BaseModel):
    """Request model for creating multiple nodes at once."""

    nodes: list[RoadNodeCreate]


class RoadEdgeBulkCreate(BaseModel):
    """Request model for creating multiple edges at once."""

    edges: list[RoadEdgeCreate]


# ============================================================================
# Defaults
# ============================================================================


ROAD_CLASS_DEFAULTS: dict[RoadClass, dict] = {
    RoadClass.HIGHWAY: {"speed_limit": 100, "lanes": 4},
    RoadClass.ARTERIAL: {"speed_limit": 60, "lanes": 4},
    RoadClass.COLLECTOR: {"speed_limit": 50, "lanes": 2},
    RoadClass.LOCAL: {"speed_limit": 40, "lanes": 2},
    RoadClass.ALLEY: {"speed_limit": 20, "lanes": 1},
}
