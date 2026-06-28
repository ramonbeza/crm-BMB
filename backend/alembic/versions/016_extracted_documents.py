"""extracted_documents table

Revision ID: 016
Revises: 015
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "extracted_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("procedure_id", UUID(as_uuid=True), sa.ForeignKey("procedures.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column("doc_type", sa.String(80), nullable=True),
        sa.Column("doc_type_label", sa.String(150), nullable=True),
        sa.Column("extracted_data", JSONB, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="extraido"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )


def downgrade():
    op.drop_table("extracted_documents")
