"""Add terrain_status and terrain_error to tiles

CITY-585/590: Add terrain_status (pending/generating/ready/failed) and
terrain_error fields to the tiles table for tracking terrain generation
state and failure reasons.

Revision ID: 023
Revises: 022
Create Date: 2026-02-21

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "023"
down_revision: str | None = "022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tiles",
        sa.Column(
            "terrain_status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "tiles",
        sa.Column("terrain_error", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tiles", "terrain_error")
    op.drop_column("tiles", "terrain_status")
