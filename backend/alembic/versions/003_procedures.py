"""procedures, stages and protocol sequence

Revision ID: 003
Revises: 002
Create Date: 2026-05-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Sequência do número de protocolo (sequencial global, começa em 1)
    op.execute("CREATE SEQUENCE IF NOT EXISTS procedure_protocol_seq START 1")

    op.create_table(
        "procedures",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("protocol_number", sa.Integer, nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("procedure_type", sa.String(40), nullable=False),
        sa.Column("opened_at", sa.Date, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("property_description", sa.Text, nullable=True),
        sa.Column("matricula", sa.String(100), nullable=True),
        sa.Column("incra", sa.String(100), nullable=True),
        sa.Column("inscricao_imobiliaria", sa.String(100), nullable=True),
        sa.Column("requerente", sa.String(300), nullable=True),
        sa.Column("deadline", sa.Date, nullable=True),
        sa.Column("tags", postgresql.JSONB, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="em_andamento"),
        sa.Column("responsible_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("attendance_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("attendances.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("protocol_number", name="uq_procedures_protocol_number"),
    )
    op.create_index("ix_procedures_protocol_number", "procedures", ["protocol_number"])
    op.create_index("ix_procedures_client_id", "procedures", ["client_id"])
    op.create_index("ix_procedures_procedure_type", "procedures", ["procedure_type"])
    op.create_index("ix_procedures_status", "procedures", ["status"])

    op.create_table(
        "procedure_stages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("procedure_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order", sa.Integer, nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pendente"),
        sa.Column("assigned_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_procedure_stages_procedure_id", "procedure_stages", ["procedure_id"])
    op.create_index("ix_procedure_stages_status", "procedure_stages", ["status"])


def downgrade() -> None:
    op.drop_table("procedure_stages")
    op.drop_table("procedures")
    op.execute("DROP SEQUENCE IF EXISTS procedure_protocol_seq")
