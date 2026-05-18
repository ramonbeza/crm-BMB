"""quotes, contracts and price_table

Revision ID: 005
Revises: 004
Create Date: 2026-05-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Sequences for numbered identifiers (per year, reset handled in app)
    op.execute("CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1")
    op.execute("CREATE SEQUENCE IF NOT EXISTS contract_number_seq START 1")

    # ── quotes ────────────────────────────────────────────────────────────────
    op.create_table(
        "quotes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("quote_number", sa.Integer, nullable=False),
        sa.Column("quote_year", sa.Integer, nullable=False),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("procedure_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("procedures.id", ondelete="SET NULL"), nullable=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("procedure_type", sa.String(40), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="rascunho"),
        sa.Column("honorarios_escritorio", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("honorarios_despachante", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("custas_estimadas", postgresql.JSONB, nullable=True),
        sa.Column("desconto", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("desconto_motivo", sa.Text, nullable=True),
        sa.Column("valid_until", sa.Date, nullable=True),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("parent_quote_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_quotes_client_id", "quotes", ["client_id"])
    op.create_index("ix_quotes_procedure_id", "quotes", ["procedure_id"])
    op.create_index("ix_quotes_status", "quotes", ["status"])
    op.create_index("ix_quotes_year_number", "quotes", ["quote_year", "quote_number"])

    # ── contracts ─────────────────────────────────────────────────────────────
    op.create_table(
        "contracts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("contract_number", sa.Integer, nullable=False),
        sa.Column("contract_year", sa.Integer, nullable=False),
        sa.Column("quote_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("procedure_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("procedures.id", ondelete="SET NULL"), nullable=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="rascunho"),
        sa.Column("payment_model", sa.String(20), nullable=False, server_default="a_definir"),
        sa.Column("total_value", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("installments", postgresql.JSONB, nullable=True),
        sa.Column("exito_percentual", sa.Numeric(5, 2), nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("signed_document_path", sa.String(500), nullable=True),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_contracts_client_id", "contracts", ["client_id"])
    op.create_index("ix_contracts_quote_id", "contracts", ["quote_id"])
    op.create_index("ix_contracts_procedure_id", "contracts", ["procedure_id"])
    op.create_index("ix_contracts_status", "contracts", ["status"])

    # ── price_table ───────────────────────────────────────────────────────────
    op.create_table(
        "price_table",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("procedure_type", sa.String(40), nullable=False, unique=True),
        sa.Column("base_honorarios", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("base_despachante", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("custas_tipicas", postgresql.JSONB, nullable=True),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("price_table")
    op.drop_table("contracts")
    op.drop_table("quotes")
    op.execute("DROP SEQUENCE IF EXISTS contract_number_seq")
    op.execute("DROP SEQUENCE IF EXISTS quote_number_seq")
