"""Add progress JSONB column to jobs

Stores incremental progress data (e.g. { "completed": 3, "total": 9 })
so the frontend can display a progress bar during long-running jobs
like terrain generation.

CITY-626: Add terrain generation progress overlay.

Revision ID: 026
Revises: 025
Create Date: 2026-02-24

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from city_api.database import JSONVariant

revision: str = "026"
down_revision: str | None = "025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column(
            "progress",
            JSONVariant,
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("jobs", "progress")
