"""legal_documents table

Revision ID: 018
Revises: 017
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "legal_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("doc_type", sa.String(50), nullable=False, index=True),
        sa.Column("scope", sa.String(20), nullable=False, server_default="municipal"),
        sa.Column("municipio", sa.String(150), nullable=True),
        sa.Column("estado", sa.String(50), nullable=True),
        sa.Column("numero", sa.String(100), nullable=True),
        sa.Column("ano", sa.String(10), nullable=True),
        sa.Column("descricao", sa.Text, nullable=True),
        sa.Column("content_b64", sa.Text, nullable=True),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column("file_size", sa.Integer, nullable=True),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_legal_documents_doc_type", "legal_documents", ["doc_type"])
    op.create_index("ix_legal_documents_scope", "legal_documents", ["scope"])
    op.create_index("ix_legal_documents_municipio", "legal_documents", ["municipio"])


def downgrade():
    op.drop_table("legal_documents")
