"""
Módulo 9 — Comunicações & Notificações
Templates de mensagem, histórico de comunicações, notificações internas.
"""
from __future__ import annotations

import enum
import uuid

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


# ── Enums ─────────────────────────────────────────────────────────────────────

class MessageChannel(str, enum.Enum):
    whatsapp = "whatsapp"
    email = "email"
    interno = "interno"


class CommStatus(str, enum.Enum):
    pendente = "pendente"
    enviado = "enviado"
    entregue = "entregue"
    lido = "lido"
    falhou = "falhou"


# ── Labels ────────────────────────────────────────────────────────────────────

CHANNEL_LABELS: dict[str, str] = {
    "whatsapp": "WhatsApp",
    "email": "E-mail",
    "interno": "Interno",
}

COMM_STATUS_LABELS: dict[str, str] = {
    "pendente": "Pendente",
    "enviado": "Enviado",
    "entregue": "Entregue",
    "lido": "Lido",
    "falhou": "Falhou",
}


# ── MessageTemplate ───────────────────────────────────────────────────────────

class MessageTemplate(UUIDMixin, TimestampMixin, Base):
    """Template reutilizável de mensagem com variáveis dinâmicas."""
    __tablename__ = "message_templates"

    name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    channel: Mapped[str] = mapped_column(sa.String(20), nullable=False)  # MessageChannel
    subject: Mapped[str | None] = mapped_column(sa.String(300), nullable=True)  # apenas email
    body: Mapped[str] = mapped_column(sa.Text, nullable=False)
    # Ex: ["nome_cliente", "numero_processo", "data_prazo"]
    variables: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default="true")

    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    created_by: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[created_by_id], lazy="select"
    )


# ── Communication (mensagens enviadas) ───────────────────────────────────────

class Communication(UUIDMixin, TimestampMixin, Base):
    """Registro de cada mensagem enviada ou tentada."""
    __tablename__ = "communications"

    channel: Mapped[str] = mapped_column(sa.String(20), nullable=False)
    status: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default="pendente")

    # Destinatário
    recipient_name: Mapped[str | None] = mapped_column(sa.String(200), nullable=True)
    recipient_phone: Mapped[str | None] = mapped_column(sa.String(30), nullable=True)
    recipient_email: Mapped[str | None] = mapped_column(sa.String(254), nullable=True)

    # Conteúdo
    subject: Mapped[str | None] = mapped_column(sa.String(300), nullable=True)
    body: Mapped[str] = mapped_column(sa.Text, nullable=False)

    # Vínculos opcionais
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("message_templates.id", ondelete="SET NULL"),
        nullable=True,
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    procedure_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("procedures.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Metadados do provider (id externo, erro, etc.)
    provider_meta: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")

    sent_at: Mapped[sa.DateTime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    template: Mapped["MessageTemplate | None"] = relationship(
        "MessageTemplate", foreign_keys=[template_id], lazy="select"
    )
    created_by: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[created_by_id], lazy="select"
    )


# ── Notification (notificações internas) ─────────────────────────────────────

class Notification(UUIDMixin, TimestampMixin, Base):
    """Notificação interna para um usuário específico."""
    __tablename__ = "notifications"

    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    link: Mapped[str | None] = mapped_column(sa.String(500), nullable=True)  # rota frontend
    tipo: Mapped[str] = mapped_column(sa.String(50), nullable=False, server_default="info")
    is_read: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default="false")
    read_at: Mapped[sa.DateTime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )

    recipient: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[recipient_id], lazy="select"
    )
