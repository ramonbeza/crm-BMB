"""010_despachante_externo

Revision ID: 010
Revises: 009
Create Date: 2026-05-19
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Campo CNPJ da empresa para despachante-externo
    op.add_column("users", sa.Column("cnpj_empresa", sa.String(20), nullable=True))

    # Executor (despachante-externo) no procedimento
    op.add_column("procedures", sa.Column("executor_user_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_procedures_executor_user",
        "procedures", "users",
        ["executor_user_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_procedures_executor_user_id", "procedures", ["executor_user_id"])


def downgrade() -> None:
    op.drop_index("ix_procedures_executor_user_id", table_name="procedures")
    op.drop_constraint("fk_procedures_executor_user", "procedures", type_="foreignkey")
    op.drop_column("procedures", "executor_user_id")
    op.drop_column("users", "cnpj_empresa")
