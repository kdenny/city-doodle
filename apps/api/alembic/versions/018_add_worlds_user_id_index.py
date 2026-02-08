"""Add index on worlds.user_id

The list_worlds_for_user query filters on user_id but there was no
index, causing a full table scan.  Other models (jobs, tiles) already
have the equivalent index.

Revision ID: 018
Revises: 017
Create Date: 2026-02-06

"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "018"
down_revision: str | None = "017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_worlds_user_id ON worlds (user_id)"))


def downgrade() -> None:
    op.drop_index("ix_worlds_user_id", table_name="worlds")
