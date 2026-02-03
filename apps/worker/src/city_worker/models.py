"""Job models for the worker.

These mirror the API models to work with the same database schema.
"""

from enum import StrEnum


class JobStatus(StrEnum):
    """Job status values."""

    PENDING = "pending"
    RUNNING = "running"
    CLAIMED = "claimed"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobType(StrEnum):
    """Job type values."""

    TERRAIN_GENERATION = "terrain_generation"
    SEED_PLACEMENT = "seed_placement"
    GROWTH_SIMULATION = "growth_simulation"
    VMT_CALCULATION = "vmt_calculation"
    CITY_GROWTH = "city_growth"
    EXPORT_PNG = "export_png"
    EXPORT_GIF = "export_gif"
