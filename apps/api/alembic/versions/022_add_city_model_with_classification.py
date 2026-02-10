"""Add city model with classification

Creates the cities table with core/suburb/town classification enum,
and adds city_id foreign keys to districts (nullable, SET NULL) and
neighborhoods (nullable, CASCADE).

CITY-563: Backend multi-city model with core/suburb/town classification.

Revision ID: 022
Revises: 021
Create Date: 2026-02-09

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "022"
down_revision: str | None = "021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create the cityclassification enum type
    cityclassification_enum = postgresql.ENUM(
        "core", "suburb", "town", name="cityclassification", create_type=False
    )
    cityclassification_enum.create(op.get_bind(), checkfirst=True)

    # Create cities table
    op.create_table(
        "cities",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "world_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("worlds.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "classification",
            cityclassification_enum,
            nullable=False,
        ),
        sa.Column("boundary", postgresql.JSONB(), nullable=False),
        sa.Column("established", sa.Integer(), nullable=True),
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
    op.create_index("ix_cities_world_id", "cities", ["world_id"])
    op.create_index("ix_cities_classification", "cities", ["classification"])

    # Add city_id to districts (nullable, SET NULL on delete)
    op.add_column(
        "districts",
        sa.Column(
            "city_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cities.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_districts_city_id", "districts", ["city_id"])

    # Add city_id to neighborhoods (nullable, CASCADE on delete)
    op.add_column(
        "neighborhoods",
        sa.Column(
            "city_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cities.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index("ix_neighborhoods_city_id", "neighborhoods", ["city_id"])


def downgrade() -> None:
    # Remove city_id from neighborhoods
    op.drop_index("ix_neighborhoods_city_id", table_name="neighborhoods")
    op.drop_column("neighborhoods", "city_id")

    # Remove city_id from districts
    op.drop_index("ix_districts_city_id", table_name="districts")
    op.drop_column("districts", "city_id")

    # Drop cities table
    op.drop_index("ix_cities_classification", table_name="cities")
    op.drop_index("ix_cities_world_id", table_name="cities")
    op.drop_table("cities")

    # Drop the enum type
    postgresql.ENUM(name="cityclassification").drop(op.get_bind(), checkfirst=True)
