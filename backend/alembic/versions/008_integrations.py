"""008_integrations

Revision ID: 008
Revises: 007
Create Date: 2026-05-18
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Adiciona google_event_id na tabela meetings
    op.add_column("meetings", sa.Column("google_event_id", sa.String(256), nullable=True))

    op.create_table(
        "google_calendar_tokens",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("token_expiry", sa.DateTime(timezone=True), nullable=True),
        sa.Column("calendar_id", sa.String(256), nullable=False, server_default="primary"),
        sa.Column("scope", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_google_calendar_tokens_user_id", "google_calendar_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_google_calendar_tokens_user_id", table_name="google_calendar_tokens")
    op.drop_table("google_calendar_tokens")
    op.drop_column("meetings", "google_event_id")
