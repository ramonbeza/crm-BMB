"""procedure workspace features: transfers, comments, tasks, attachments

Revision ID: 021
Revises: 020
Create Date: 2026-08-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── procedure_transfers ───────────────────────────────────────────────────
    op.create_table(
        "procedure_transfers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("procedure_id", UUID(as_uuid=True),
                  sa.ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("from_user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("to_user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=False),
        sa.Column("transferred_by_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  onupdate=sa.func.now(), nullable=False),
    )

    # ── procedure_comments ────────────────────────────────────────────────────
    op.create_table(
        "procedure_comments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("procedure_id", UUID(as_uuid=True),
                  sa.ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("author_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  onupdate=sa.func.now(), nullable=False),
    )

    # ── procedure_tasks ───────────────────────────────────────────────────────
    op.create_table(
        "procedure_tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("procedure_id", UUID(as_uuid=True),
                  sa.ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("assigned_to_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pendente"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_procedure_tasks_status", "procedure_tasks", ["status"])

    # ── procedure_attachments ─────────────────────────────────────────────────
    op.create_table(
        "procedure_attachments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("procedure_id", UUID(as_uuid=True),
                  sa.ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("uploaded_by_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column("file_size", sa.Integer, nullable=True),
        sa.Column("storage_key", sa.String(1000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  onupdate=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("procedure_attachments")
    op.drop_index("ix_procedure_tasks_status", "procedure_tasks")
    op.drop_table("procedure_tasks")
    op.drop_table("procedure_comments")
    op.drop_table("procedure_transfers")
