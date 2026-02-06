"""Add 'trail' value to road_class enum

Revision ID: 015
Revises: 014
Create Date: 2026-02-06

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "015"
down_revision: str | None = "014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE road_class ADD VALUE IF NOT EXISTS 'trail'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values; this is a no-op.
    pass
