"""014_property_subtipo

Revision ID: 014
Revises: 013
Create Date: 2026-06-27
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("subtipo", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("properties", "subtipo")
