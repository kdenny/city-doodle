"""Add POIs table

Revision ID: 013
Revises: 012
Create Date: 2026-02-05

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "013"
down_revision: str = "012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create poi_type enum
    poi_type_enum = postgresql.ENUM(
        "hospital",
        "school",
        "university",
        "park",
        "transit",
        "shopping",
        "civic",
        "industrial",
        name="poi_type",
        create_type=False,
    )
    poi_type_enum.create(op.get_bind(), checkfirst=True)

    # Create pois table
    op.create_table(
        "pois",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "world_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("worlds.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "type",
            poi_type_enum,
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("position_x", sa.Float, nullable=False),
        sa.Column("position_y", sa.Float, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_pois_world_id", "pois", ["world_id"])
    op.create_index("ix_pois_type", "pois", ["type"])


def downgrade() -> None:
    op.drop_table("pois")
    # Drop the enum type
    op.execute("DROP TYPE IF EXISTS poi_type")
