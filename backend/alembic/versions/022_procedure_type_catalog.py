"""catálogo editável de tipos de procedimento (procedure_types)

Revision ID: 022
Revises: 021
Create Date: 2026-08-26
"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


# Seed: mesmos 19 tipos que já existiam como enum fixo em app.models.procedure.
_SEED_TYPES: list[tuple[str, str]] = [
    ("transferencia_imovel", "Transferência de Imóvel (ITBI + Escritura + Registro)"),
    ("compra_venda", "Compra e Venda"),
    ("doacao_imovel", "Doação de Imóvel"),
    ("permuta", "Permuta"),
    ("divisao_amigavel", "Divisão Amigável"),
    ("unificacao_matriculas", "Unificação de Matrículas"),
    ("averbacao", "Averbação"),
    ("regularizacao_imovel", "Regularização de Imóvel"),
    ("usucapiao_judicial", "Usucapião Judicial"),
    ("usucapiao_extrajudicial", "Usucapião Extrajudicial"),
    ("retificacao_administrativa", "Retificação Administrativa"),
    ("loteamento", "Loteamento"),
    ("desmembramento_rural", "Desmembramento Rural"),
    ("desmembramento_urbano", "Desmembramento Urbano"),
    ("notificacao_extrajudicial", "Notificação Extrajudicial"),
    ("incorporacao_imobiliaria", "Incorporação Imobiliária"),
    ("instituicao_imobiliaria", "Instituição Imobiliária"),
    ("inventario_extrajudicial", "Inventário Extrajudicial"),
    ("divorcio", "Divórcio"),
]


def upgrade() -> None:
    op.create_table(
        "procedure_types",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(60), nullable=False, unique=True),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_procedure_types_code", "procedure_types", ["code"])

    table = sa.table(
        "procedure_types",
        sa.column("id", UUID(as_uuid=True)),
        sa.column("code", sa.String),
        sa.column("label", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("sort_order", sa.Integer),
    )
    op.bulk_insert(table, [
        {"id": uuid.uuid4(), "code": code, "label": label, "is_active": True, "sort_order": i}
        for i, (code, label) in enumerate(_SEED_TYPES)
    ])


def downgrade() -> None:
    op.drop_index("ix_procedure_types_code", table_name="procedure_types")
    op.drop_table("procedure_types")
