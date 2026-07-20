"""add meeting_category and make client_id nullable

Revision ID: 019
Revises: 018
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade():
    # Add meeting_category column with default for existing rows
    op.add_column(
        "meetings",
        sa.Column("meeting_category", sa.String(30), nullable=False, server_default="reuniao_cliente"),
    )
    # Make client_id nullable (meetings may not be tied to a client)
    op.alter_column("meetings", "client_id", nullable=True)
    # Change FK ondelete from CASCADE to SET NULL to match nullable semantics
    op.drop_constraint("meetings_client_id_fkey", "meetings", type_="foreignkey")
    op.create_foreign_key(
        "meetings_client_id_fkey", "meetings", "clients", ["client_id"], ["id"],
        ondelete="SET NULL",
    )
    # Add videochamada to reception_type (no enum constraint in PG for this column,
    # it's stored as varchar so no DDL change needed beyond accepting it in application)


def downgrade():
    op.drop_column("meetings", "meeting_category")
    op.alter_column("meetings", "client_id", nullable=False)
    op.drop_constraint("meetings_client_id_fkey", "meetings", type_="foreignkey")
    op.create_foreign_key(
        "meetings_client_id_fkey", "meetings", "clients", ["client_id"], ["id"],
        ondelete="CASCADE",
    )
