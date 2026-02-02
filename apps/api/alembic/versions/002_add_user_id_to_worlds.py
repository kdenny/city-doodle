"""Add user_id to worlds table

Revision ID: 002
Revises: 001
Create Date: 2026-02-02

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add user_id column to worlds table
    op.add_column(
        "worlds",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.create_index("ix_worlds_user_id", "worlds", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_worlds_user_id", table_name="worlds")
    op.drop_column("worlds", "user_id")
