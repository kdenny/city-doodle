"""Add unique constraint on transit line name per world

Prevents duplicate transit line names within the same world.

Revision ID: 021
Revises: 020
Create Date: 2026-02-08

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "021"
down_revision: str | None = "020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_transit_line_world_name",
        "transit_lines",
        ["world_id", "name"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_transit_line_world_name", "transit_lines", type_="unique")
