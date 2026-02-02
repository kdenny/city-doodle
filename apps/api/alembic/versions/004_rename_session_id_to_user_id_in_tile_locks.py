"""Rename session_id to user_id in tile_locks

Revision ID: 004
Revises: 003
Create Date: 2026-02-02

"""

from collections.abc import Sequence

from alembic import op

revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Rename session_id to user_id for consistency with schema and repo
    op.alter_column("tile_locks", "session_id", new_column_name="user_id")


def downgrade() -> None:
    op.alter_column("tile_locks", "user_id", new_column_name="session_id")
