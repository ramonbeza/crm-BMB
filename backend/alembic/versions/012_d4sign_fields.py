"""012_d4sign_fields

Revision ID: 012
Revises: 011
Create Date: 2026-05-19
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # quotes
    op.add_column("quotes", sa.Column("d4sign_document_uuid", sa.String(100), nullable=True))
    op.add_column("quotes", sa.Column("d4sign_sign_url", sa.String(500), nullable=True))
    op.add_column("quotes", sa.Column("d4sign_status", sa.String(30), nullable=True))

    # contracts
    op.add_column("contracts", sa.Column("d4sign_document_uuid", sa.String(100), nullable=True))
    op.add_column("contracts", sa.Column("d4sign_sign_url", sa.String(500), nullable=True))
    op.add_column("contracts", sa.Column("d4sign_status", sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column("contracts", "d4sign_status")
    op.drop_column("contracts", "d4sign_sign_url")
    op.drop_column("contracts", "d4sign_document_uuid")

    op.drop_column("quotes", "d4sign_status")
    op.drop_column("quotes", "d4sign_sign_url")
    op.drop_column("quotes", "d4sign_document_uuid")
