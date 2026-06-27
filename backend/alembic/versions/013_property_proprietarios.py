"""013_property_proprietarios

Revision ID: 013
Revises: 012
Create Date: 2026-06-27
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("proprietarios", JSONB, nullable=True, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("properties", "proprietarios")
