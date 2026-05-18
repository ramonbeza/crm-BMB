"""properties, property_clients and checklist_items

Revision ID: 004
Revises: 003
Create Date: 2026-05-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── properties ────────────────────────────────────────────────────────────
    op.create_table(
        "properties",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("matricula", sa.String(100), nullable=True),
        sa.Column("inscricao_imobiliaria", sa.String(100), nullable=True),
        sa.Column("incra_code", sa.String(100), nullable=True),
        sa.Column("property_type", sa.String(20), nullable=False, server_default="urbano"),
        sa.Column("endereco", sa.Text, nullable=True),
        sa.Column("area_total", sa.Numeric(12, 4), nullable=True),
        sa.Column("area_unit", sa.String(10), nullable=False, server_default="m2"),
        sa.Column("cartorio", sa.String(300), nullable=True),
        sa.Column("confrontantes", sa.Text, nullable=True),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_properties_matricula", "properties", ["matricula"])

    # ── property_clients (M2M) ────────────────────────────────────────────────
    op.create_table(
        "property_clients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(60), nullable=False, server_default="proprietario"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_property_clients_property_id", "property_clients", ["property_id"])
    op.create_index("ix_property_clients_client_id", "property_clients", ["client_id"])

    # ── checklist_items ───────────────────────────────────────────────────────
    op.create_table(
        "checklist_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("procedure_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order", sa.Integer, nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("responsavel", sa.String(20), nullable=False, server_default="cliente"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pendente"),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_checklist_items_procedure_id", "checklist_items", ["procedure_id"])

    # ── FK property_id → procedures ───────────────────────────────────────────
    op.add_column("procedures", sa.Column("property_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_procedures_property_id", "procedures", "properties", ["property_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_procedures_property_id", "procedures", ["property_id"])


def downgrade() -> None:
    op.drop_index("ix_procedures_property_id", "procedures")
    op.drop_constraint("fk_procedures_property_id", "procedures", type_="foreignkey")
    op.drop_column("procedures", "property_id")
    op.drop_table("checklist_items")
    op.drop_table("property_clients")
    op.drop_table("properties")
