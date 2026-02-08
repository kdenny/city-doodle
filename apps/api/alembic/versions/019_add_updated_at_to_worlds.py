"""Add updated_at column to worlds table

Tracks when a world was last modified so we can sort by "last edited".
Defaults to created_at for existing rows.

Revision ID: 019
Revises: 018
Create Date: 2026-02-07

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "019"
down_revision: str | None = "018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "worlds",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    # Backfill existing rows: set updated_at = created_at
    op.execute("UPDATE worlds SET updated_at = created_at")


def downgrade() -> None:
    op.drop_column("worlds", "updated_at")
