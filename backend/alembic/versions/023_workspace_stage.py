"""workspace_stage — coluna do kanban em Minha Área, independente do status

Revision ID: 023
Revises: 022
Create Date: 2026-08-26
"""
from alembic import op
import sqlalchemy as sa

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "procedures",
        sa.Column("workspace_stage", sa.String(20), nullable=False, server_default="novo"),
    )
    op.create_index("ix_procedures_workspace_stage", "procedures", ["workspace_stage"])

    # Backfill: procedimentos já com alguma etapa concluída viram "em_andamento"
    # no quadro; procedimentos concluídos/cancelados viram "concluido"; o resto
    # fica "novo" (valor default já aplicado pela coluna acima).
    op.execute("""
        UPDATE procedures p
        SET workspace_stage = 'concluido'
        WHERE p.status IN ('concluido', 'cancelado')
    """)
    op.execute("""
        UPDATE procedures p
        SET workspace_stage = 'em_andamento'
        WHERE p.status = 'em_andamento'
          AND EXISTS (
              SELECT 1 FROM procedure_stages s
              WHERE s.procedure_id = p.id AND s.status = 'concluida'
          )
    """)


def downgrade() -> None:
    op.drop_index("ix_procedures_workspace_stage", table_name="procedures")
    op.drop_column("procedures", "workspace_stage")
