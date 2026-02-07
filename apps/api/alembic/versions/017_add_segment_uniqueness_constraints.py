"""Add unique and check constraints to transit_line_segments

Prevents duplicate segments (same line + from_station + to_station)
and self-referencing segments (from_station == to_station).

Revision ID: 017
Revises: 016
Create Date: 2026-02-06

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "017"
down_revision: str | None = "016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_segment_line_stations",
        "transit_line_segments",
        ["line_id", "from_station_id", "to_station_id"],
    )
    op.create_check_constraint(
        "ck_segment_no_self_ref",
        "transit_line_segments",
        "from_station_id != to_station_id",
    )


def downgrade() -> None:
    op.drop_constraint("ck_segment_no_self_ref", "transit_line_segments", type_="check")
    op.drop_constraint("uq_segment_line_stations", "transit_line_segments", type_="unique")
