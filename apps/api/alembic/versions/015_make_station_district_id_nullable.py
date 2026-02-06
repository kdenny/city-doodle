"""Make transit_stations.district_id nullable to match SET NULL FK behavior

Revision ID: 015
Revises: 014
Create Date: 2026-02-06

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "015"
down_revision: str | None = "014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "transit_stations",
        "district_id",
        existing_type=sa.UUID(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "transit_stations",
        "district_id",
        existing_type=sa.UUID(),
        nullable=False,
    )
