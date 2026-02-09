"""Add footprint JSONB column to pois table (CITY-440)

Revision ID: 021
Revises: 020
Create Date: 2026-02-08

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "021"
down_revision: str = "020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pois",
        sa.Column("footprint", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pois", "footprint")
