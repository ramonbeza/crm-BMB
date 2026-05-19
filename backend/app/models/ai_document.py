"""
Sprint 10 — Modelo para documentos gerados por IA (Claude API).
"""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class AIDocumentType:
    """Tipos de documento que a IA pode gerar."""
    REQUERIMENTO = "requerimento"
    CONTRATO_HONORARIOS = "contrato_honorarios"
    NOTIFICACAO_EXTRAJUDICIAL = "notificacao_extrajudicial"
    DECLARACAO = "declaracao"
    PROCURACAO = "procuracao"
    MINUTA_CONTRATO = "minuta_contrato"
    PARECER = "parecer"
    RESUMO_PROCEDIMENTO = "resumo_procedimento"


AI_DOCUMENT_LABELS: dict[str, str] = {
    AIDocumentType.REQUERIMENTO: "Requerimento",
    AIDocumentType.CONTRATO_HONORARIOS: "Contrato de Honorários",
    AIDocumentType.NOTIFICACAO_EXTRAJUDICIAL: "Notificação Extrajudicial",
    AIDocumentType.DECLARACAO: "Declaração",
    AIDocumentType.PROCURACAO: "Procuração",
    AIDocumentType.MINUTA_CONTRATO: "Minuta de Contrato",
    AIDocumentType.PARECER: "Parecer",
    AIDocumentType.RESUMO_PROCEDIMENTO: "Resumo do Procedimento",
}


class AIDocumentStatus:
    PENDING = "pendente"
    GENERATING = "gerando"
    DONE = "concluido"
    FAILED = "falhou"


class AIDocument(Base, UUIDMixin, TimestampMixin):
    """Documento gerado pela IA para um procedimento."""

    __tablename__ = "ai_documents"

    procedure_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("procedures.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requested_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    doc_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=AIDocumentStatus.PENDING, index=True
    )
    prompt_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tokens_input: Mapped[int | None] = mapped_column(nullable=True)
    tokens_output: Mapped[int | None] = mapped_column(nullable=True)

    procedure: Mapped["Procedure"] = relationship("Procedure")  # type: ignore[name-defined]
    requested_by: Mapped["User"] = relationship("User")  # type: ignore[name-defined]
