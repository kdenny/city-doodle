"""Add street_grid JSONB column to districts table

Revision ID: 014
Revises: 013
Create Date: 2026-02-06

"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import Column
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "014"
down_revision: str | None = "013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "districts",
        Column("street_grid", postgresql.JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("districts", "street_grid")
