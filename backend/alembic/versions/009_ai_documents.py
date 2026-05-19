"""009_ai_documents

Revision ID: 009
Revises: 008
Create Date: 2026-05-19
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_documents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("procedure_id", sa.UUID(), nullable=False),
        sa.Column("requested_by_id", sa.UUID(), nullable=True),
        sa.Column("doc_type", sa.String(60), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pendente"),
        sa.Column("prompt_used", sa.Text(), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("model_used", sa.String(100), nullable=True),
        sa.Column("tokens_input", sa.Integer(), nullable=True),
        sa.Column("tokens_output", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["procedure_id"], ["procedures.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_documents_procedure_id", "ai_documents", ["procedure_id"])
    op.create_index("ix_ai_documents_status", "ai_documents", ["status"])
    op.create_index("ix_ai_documents_doc_type", "ai_documents", ["doc_type"])


def downgrade() -> None:
    op.drop_index("ix_ai_documents_doc_type", table_name="ai_documents")
    op.drop_index("ix_ai_documents_status", table_name="ai_documents")
    op.drop_index("ix_ai_documents_procedure_id", table_name="ai_documents")
    op.drop_table("ai_documents")
