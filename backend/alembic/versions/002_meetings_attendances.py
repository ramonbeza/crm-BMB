"""meetings and attendances

Revision ID: 002
Revises: 001
Create Date: 2026-05-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── meetings ──────────────────────────────────────────────────────────────
    op.create_table(
        "meetings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reception_type", sa.String(20), nullable=False, server_default="presencial"),
        sa.Column("subject", sa.String(300), nullable=False),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="agendada"),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_meetings_client_id", "meetings", ["client_id"])
    op.create_index("ix_meetings_user_id", "meetings", ["user_id"])
    op.create_index("ix_meetings_scheduled_at", "meetings", ["scheduled_at"])
    op.create_index("ix_meetings_status", "meetings", ["status"])

    # ── attendances ───────────────────────────────────────────────────────────
    op.create_table(
        "attendances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("meetings.id", ondelete="SET NULL"), nullable=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("decisions", sa.Text, nullable=True),
        sa.Column("pending_items", sa.Text, nullable=True),
        sa.Column("converted_to_procedure", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_attendances_meeting_id", "attendances", ["meeting_id"])
    op.create_index("ix_attendances_client_id", "attendances", ["client_id"])
    op.create_index("ix_attendances_converted", "attendances", ["converted_to_procedure"])


def downgrade() -> None:
    op.drop_table("attendances")
    op.drop_table("meetings")
