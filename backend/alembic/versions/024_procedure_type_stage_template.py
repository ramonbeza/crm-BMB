"""stage_template por tipo de procedimento — etapas editáveis em Gerenciar tipos

Revision ID: 024
Revises: 023
Create Date: 2026-08-26
"""
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


STANDARD_STAGES = [
    "Análise do caso concreto / conferência do checklist",
    "Elaboração da proposta de honorários/serviços",
    "Elaboração e assinatura do contrato de honorários",
    "Elaboração dos documentos necessários (requerimentos, declarações, revisão técnica)",
    "Orientação das partes quanto às assinaturas",
    "Prenotação dos documentos na Prefeitura e/ou cartório competente",
    "Saneamento das exigências",
    "Finalização e entrega do processo",
]


def upgrade() -> None:
    op.add_column(
        "procedure_types",
        sa.Column("stage_template", JSONB, nullable=True),
    )
    default_json = json.dumps(STANDARD_STAGES, ensure_ascii=False)
    op.execute(
        sa.text("UPDATE procedure_types SET stage_template = CAST(:tpl AS jsonb)")
        .bindparams(tpl=default_json)
    )
    op.alter_column("procedure_types", "stage_template", nullable=False)


def downgrade() -> None:
    op.drop_column("procedure_types", "stage_template")
