"""006_financial

Revision ID: 006
Revises: 005
Create Date: 2025-05-01

Módulo 8 — Gestão Financeira:
  - Sequência repasse_number_seq
  - Tabela financial_entries
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Sequência para numeração de repasses ─────────────────────────────────
    op.execute("CREATE SEQUENCE IF NOT EXISTS repasse_number_seq START 1")

    # ── Tabela principal ──────────────────────────────────────────────────────
    op.create_table(
        "financial_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        # Número sequencial (para repasses)
        sa.Column("entry_number", sa.Integer, nullable=True),
        sa.Column("entry_year", sa.Integer, nullable=True),
        # Vínculos
        sa.Column("procedure_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("procedures.id", ondelete="SET NULL"), nullable=True),
        sa.Column("contract_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True),
        # Classificação
        sa.Column("tipo", sa.String(50), nullable=False),
        sa.Column("category", sa.String(50), nullable=False, server_default="outro"),
        sa.Column("description", sa.String(500), nullable=False),
        # Valor e estado
        sa.Column("value", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pendente"),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notas", sa.Text, nullable=True),
        # Criador
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )

    # Índices
    op.create_index("ix_financial_entries_procedure_id", "financial_entries", ["procedure_id"])
    op.create_index("ix_financial_entries_contract_id", "financial_entries", ["contract_id"])
    op.create_index("ix_financial_entries_client_id", "financial_entries", ["client_id"])
    op.create_index("ix_financial_entries_tipo", "financial_entries", ["tipo"])
    op.create_index("ix_financial_entries_status", "financial_entries", ["status"])


def downgrade() -> None:
    op.drop_table("financial_entries")
    op.execute("DROP SEQUENCE IF EXISTS repasse_number_seq")
