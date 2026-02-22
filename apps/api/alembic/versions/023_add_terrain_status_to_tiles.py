"""Add terrain_status and terrain_error columns to tiles

Adds a terrain_status VARCHAR column (default 'pending') and a nullable
terrain_error TEXT column for tracking terrain generation lifecycle.

CITY-585: Add terrain_status field to tile model for tracking generation state.

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
        sa.Column(
            "terrain_error",
            sa.Text(),
            nullable=True,
        ),
    )
    op.create_index("ix_tiles_terrain_status", "tiles", ["terrain_status"])


def downgrade() -> None:
    op.drop_index("ix_tiles_terrain_status", table_name="tiles")
    op.drop_column("tiles", "terrain_error")
    op.drop_column("tiles", "terrain_status")
