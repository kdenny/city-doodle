"""Add token column to sessions table

Revision ID: 005
Revises: 004
Create Date: 2026-02-02

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: str | None = "004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("token", sa.String(64), unique=True, nullable=False),
    )
    op.create_index("ix_sessions_token", "sessions", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_sessions_token", table_name="sessions")
    op.drop_column("sessions", "token")
