"""add recurrence fields and duration_minutes to meetings

Revision ID: 020
Revises: 019
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("meetings", sa.Column("duration_minutes", sa.Integer, nullable=False, server_default="60"))
    op.add_column("meetings", sa.Column("recurrence_type", sa.String(20), nullable=False, server_default="none"))
    op.add_column("meetings", sa.Column("recurrence_days", sa.String(20), nullable=True))
    op.add_column("meetings", sa.Column("recurrence_end_date", sa.Date, nullable=True))


def downgrade():
    op.drop_column("meetings", "duration_minutes")
    op.drop_column("meetings", "recurrence_type")
    op.drop_column("meetings", "recurrence_days")
    op.drop_column("meetings", "recurrence_end_date")
