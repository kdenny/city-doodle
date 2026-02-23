"""Add retry_count, max_retries, and retry_after columns to jobs

Adds retry_count (default 0), max_retries (default 3), and retry_after
(nullable timestamp) columns to the jobs table for automatic retry of
failed worker jobs with exponential backoff.

CITY-453: Add retry logic for failed worker jobs.

Revision ID: 024
Revises: 023
Create Date: 2026-02-21

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "024"
down_revision: str | None = "023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column(
            "retry_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "jobs",
        sa.Column(
            "max_retries",
            sa.Integer(),
            nullable=False,
            server_default="3",
        ),
    )
    op.add_column(
        "jobs",
        sa.Column(
            "retry_after",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("jobs", "retry_after")
    op.drop_column("jobs", "max_retries")
    op.drop_column("jobs", "retry_count")
