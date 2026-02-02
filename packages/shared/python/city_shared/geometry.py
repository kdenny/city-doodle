"""Core geometry schemas used across the application."""

from pydantic import BaseModel


class Point(BaseModel):
    """A 2D point."""

    x: float
    y: float


class BoundingBox(BaseModel):
    """An axis-aligned bounding box."""

    min_x: float
    min_y: float
    max_x: float
    max_y: float


class TileCoord(BaseModel):
    """A tile coordinate in the grid."""

    row: int
    col: int
