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
    # ── Geral ─────────────────────────────────────────────────────────────────
    REQUERIMENTO = "requerimento"
    CONTRATO_HONORARIOS = "contrato_honorarios"
    NOTIFICACAO_EXTRAJUDICIAL = "notificacao_extrajudicial"
    DECLARACAO = "declaracao"
    PROCURACAO = "procuracao"
    MINUTA_CONTRATO = "minuta_contrato"
    PARECER = "parecer"
    RESUMO_PROCEDIMENTO = "resumo_procedimento"
    OFICIO_CARTORIO = "oficio_cartorio"
    OFICIO_PREFEITURA = "oficio_prefeitura"
    RECIBO_PAGAMENTO = "recibo_pagamento"
    CONTRATO_CESSAO = "contrato_cessao"
    # ── Usucapião ─────────────────────────────────────────────────────────────
    ATA_NOTARIAL = "ata_notarial"
    REQUERIMENTO_USUCAPIAO = "requerimento_usucapiao"
    EDITAL_USUCAPIAO = "edital_usucapiao"
    ANUENCIA_CONFRONTANTES = "anuencia_confrontantes"
    # ── Retificação ───────────────────────────────────────────────────────────
    REQUERIMENTO_RETIFICACAO = "requerimento_retificacao"
    AUTO_DECLARATORIO = "auto_declaratorio"
    # ── Loteamento / Desmembramento ───────────────────────────────────────────
    REQUERIMENTO_LOTEAMENTO = "requerimento_loteamento"
    MEMORIAL_LOTEAMENTO = "memorial_loteamento"
    # ── Incorporação / Instituição ────────────────────────────────────────────
    ATA_ASSEMBLEIA = "ata_assembleia"
    CONVENCAO_CONDOMINIO = "convencao_condominio"
    REQUERIMENTO_INCORPORACAO = "requerimento_incorporacao"
    REGIMENTO_INTERNO = "regimento_interno"
    # ── Inventário / Divórcio ─────────────────────────────────────────────────
    FORMAL_PARTILHA = "formal_partilha"
    DECLARACAO_MEACAO = "declaracao_meacao"
    MINUTA_ESCRITURA = "minuta_escritura"


AI_DOCUMENT_LABELS: dict[str, str] = {
    # Geral
    AIDocumentType.REQUERIMENTO: "Requerimento",
    AIDocumentType.CONTRATO_HONORARIOS: "Contrato de Honorários",
    AIDocumentType.NOTIFICACAO_EXTRAJUDICIAL: "Notificação Extrajudicial",
    AIDocumentType.DECLARACAO: "Declaração",
    AIDocumentType.PROCURACAO: "Procuração",
    AIDocumentType.MINUTA_CONTRATO: "Minuta de Contrato",
    AIDocumentType.PARECER: "Parecer",
    AIDocumentType.RESUMO_PROCEDIMENTO: "Resumo do Procedimento",
    AIDocumentType.OFICIO_CARTORIO: "Ofício ao Cartório",
    AIDocumentType.OFICIO_PREFEITURA: "Ofício à Prefeitura",
    AIDocumentType.RECIBO_PAGAMENTO: "Recibo de Pagamento",
    AIDocumentType.CONTRATO_CESSAO: "Contrato de Cessão de Direitos",
    # Usucapião
    AIDocumentType.ATA_NOTARIAL: "Ata Notarial de Posse",
    AIDocumentType.REQUERIMENTO_USUCAPIAO: "Requerimento de Usucapião",
    AIDocumentType.EDITAL_USUCAPIAO: "Edital de Usucapião",
    AIDocumentType.ANUENCIA_CONFRONTANTES: "Anuência dos Confrontantes",
    # Retificação
    AIDocumentType.REQUERIMENTO_RETIFICACAO: "Requerimento de Retificação",
    AIDocumentType.AUTO_DECLARATORIO: "Auto Declaratório",
    # Loteamento / Desmembramento
    AIDocumentType.REQUERIMENTO_LOTEAMENTO: "Requerimento de Loteamento",
    AIDocumentType.MEMORIAL_LOTEAMENTO: "Memorial Descritivo do Loteamento",
    # Incorporação / Instituição
    AIDocumentType.ATA_ASSEMBLEIA: "Ata de Assembleia",
    AIDocumentType.CONVENCAO_CONDOMINIO: "Minuta da Convenção de Condomínio",
    AIDocumentType.REQUERIMENTO_INCORPORACAO: "Requerimento de Incorporação",
    AIDocumentType.REGIMENTO_INTERNO: "Regimento Interno do Condomínio",
    # Inventário / Divórcio
    AIDocumentType.FORMAL_PARTILHA: "Formal de Partilha",
    AIDocumentType.DECLARACAO_MEACAO: "Declaração de Meação",
    AIDocumentType.MINUTA_ESCRITURA: "Minuta de Escritura",
}

# Documentos sugeridos por tipo de procedimento
SUGGESTED_DOCS_BY_PROCEDURE: dict[str, list[str]] = {
    "usucapiao_judicial": ["requerimento_usucapiao", "procuracao", "declaracao", "contrato_honorarios", "parecer"],
    "usucapiao_extrajudicial": ["requerimento_usucapiao", "ata_notarial", "edital_usucapiao", "anuencia_confrontantes", "procuracao", "contrato_honorarios"],
    "retificacao_administrativa": ["requerimento_retificacao", "auto_declaratorio", "anuencia_confrontantes", "procuracao", "contrato_honorarios"],
    "loteamento": ["requerimento_loteamento", "memorial_loteamento", "oficio_prefeitura", "procuracao", "contrato_honorarios"],
    "desmembramento_rural": ["requerimento_loteamento", "memorial_loteamento", "oficio_cartorio", "procuracao", "contrato_honorarios"],
    "desmembramento_urbano": ["requerimento_loteamento", "oficio_prefeitura", "procuracao", "contrato_honorarios"],
    "notificacao_extrajudicial": ["notificacao_extrajudicial", "contrato_honorarios", "declaracao"],
    "incorporacao_imobiliaria": ["requerimento_incorporacao", "ata_assembleia", "convencao_condominio", "regimento_interno", "oficio_cartorio", "contrato_honorarios"],
    "instituicao_imobiliaria": ["requerimento_incorporacao", "convencao_condominio", "regimento_interno", "ata_assembleia", "oficio_cartorio", "contrato_honorarios"],
    "inventario_extrajudicial": ["formal_partilha", "declaracao_meacao", "minuta_escritura", "procuracao", "contrato_honorarios"],
    "divorcio": ["declaracao_meacao", "minuta_escritura", "procuracao", "contrato_honorarios"],
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
