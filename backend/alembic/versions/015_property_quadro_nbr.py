"""add quadro_areas_nbr to properties

Revision ID: 015
Revises: 014
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "properties",
        sa.Column("quadro_areas_nbr", JSONB, nullable=True, server_default=None),
    )


def downgrade():
    op.drop_column("properties", "quadro_areas_nbr")
