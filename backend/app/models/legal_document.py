"""Banco de Leis e Normas — documentos legislativos para consulta por IA."""
from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

LEGAL_DOC_TYPE_LABELS: dict[str, str] = {
    "plano_diretor": "Plano Diretor",
    "lei_complementar": "Lei Complementar",
    "lei_ordinaria": "Lei Ordinária",
    "decreto": "Decreto",
    "resolucao_cnj": "Resolução CNJ",
    "instrucao_normativa": "Instrução Normativa",
    "provimento_cnj": "Provimento CNJ",
    "norma_abnt": "Norma ABNT",
    "outro": "Outro",
}

LEGAL_DOC_SCOPE_LABELS: dict[str, str] = {
    "federal": "Federal",
    "estadual": "Estadual",
    "municipal": "Municipal",
}


class LegalDocument(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "legal_documents"

    name: Mapped[str] = mapped_column(sa.String(300), nullable=False)
    doc_type: Mapped[str] = mapped_column(sa.String(50), nullable=False, index=True)
    scope: Mapped[str] = mapped_column(sa.String(20), nullable=False, default="municipal", index=True)
    municipio: Mapped[str | None] = mapped_column(sa.String(150), nullable=True, index=True)
    estado: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
    numero: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    ano: Mapped[str | None] = mapped_column(sa.String(10), nullable=True)
    descricao: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    content_b64: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    content_type: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    file_size: Mapped[int | None] = mapped_column(nullable=True)
    summary: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=True)
