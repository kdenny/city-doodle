"""Add metadata column to placed_seeds for park configuration

Revision ID: 011
Revises: 010b
Create Date: 2026-02-05

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "011"
down_revision: str = "010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add seed_metadata column for storing park-specific configuration
    # (size, name, features, connected road, etc.)
    # Named "seed_metadata" to avoid conflict with SQLAlchemy's reserved "metadata" attribute
    op.add_column(
        "placed_seeds",
        sa.Column(
            "seed_metadata",
            postgresql.JSONB,
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("placed_seeds", "seed_metadata")
