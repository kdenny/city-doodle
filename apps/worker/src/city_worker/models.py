"""Job models for the worker.

These mirror the API models to work with the same database schema.
"""

from enum import Enum


class JobStatus(str, Enum):
    """Job status values."""

    PENDING = "pending"
    CLAIMED = "claimed"
    COMPLETED = "completed"
    FAILED = "failed"


class JobType(str, Enum):
    """Job type values."""

    TERRAIN_GENERATION = "terrain_generation"
    CITY_GROWTH = "city_growth"
    EXPORT_PNG = "export_png"
    EXPORT_GIF = "export_gif"
