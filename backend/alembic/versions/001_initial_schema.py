"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="estagiario"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ── refresh_tokens ────────────────────────────────────────────────────────
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])

    # ── clients ───────────────────────────────────────────────────────────────
    op.create_table(
        "clients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("client_type", sa.String(2), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_clients_client_type", "clients", ["client_type"])

    # ── clients_pf ────────────────────────────────────────────────────────────
    op.create_table(
        "clients_pf",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("cpf", sa.String(14), nullable=False, unique=True),
        sa.Column("birth_date", sa.Date, nullable=True),
        sa.Column("civil_status", sa.String(30), nullable=True),
        sa.Column("rg", sa.String(30), nullable=True),
        sa.Column("cnh", sa.String(20), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
    )
    op.create_index("ix_clients_pf_name", "clients_pf", ["name"])
    op.create_index("ix_clients_pf_cpf", "clients_pf", ["cpf"], unique=True)

    # ── clients_pj ────────────────────────────────────────────────────────────
    op.create_table(
        "clients_pj",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("company_name", sa.String(300), nullable=False),
        sa.Column("cnpj", sa.String(18), nullable=False, unique=True),
        sa.Column("address", sa.String(500), nullable=True),
    )
    op.create_index("ix_clients_pj_company_name", "clients_pj", ["company_name"])
    op.create_index("ix_clients_pj_cnpj", "clients_pj", ["cnpj"], unique=True)


def downgrade() -> None:
    op.drop_table("clients_pj")
    op.drop_table("clients_pf")
    op.drop_table("clients")
    op.drop_table("refresh_tokens")
    op.drop_table("users")
