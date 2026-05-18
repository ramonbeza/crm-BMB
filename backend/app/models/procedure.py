import uuid
from datetime import date, datetime
from enum import Enum

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class ProcedureType(str, Enum):
    usucapiao_judicial = "usucapiao_judicial"
    usucapiao_extrajudicial = "usucapiao_extrajudicial"
    retificacao_administrativa = "retificacao_administrativa"
    loteamento = "loteamento"
    desmembramento_rural = "desmembramento_rural"
    desmembramento_urbano = "desmembramento_urbano"
    notificacao_extrajudicial = "notificacao_extrajudicial"
    incorporacao_imobiliaria = "incorporacao_imobiliaria"
    instituicao_imobiliaria = "instituicao_imobiliaria"
    inventario_extrajudicial = "inventario_extrajudicial"
    divorcio = "divorcio"


PROCEDURE_TYPE_LABELS: dict[str, str] = {
    "usucapiao_judicial": "Usucapião Judicial",
    "usucapiao_extrajudicial": "Usucapião Extrajudicial",
    "retificacao_administrativa": "Retificação Administrativa",
    "loteamento": "Loteamento",
    "desmembramento_rural": "Desmembramento Rural",
    "desmembramento_urbano": "Desmembramento Urbano",
    "notificacao_extrajudicial": "Notificação Extrajudicial",
    "incorporacao_imobiliaria": "Incorporação Imobiliária",
    "instituicao_imobiliaria": "Instituição Imobiliária",
    "inventario_extrajudicial": "Inventário Extrajudicial",
    "divorcio": "Divórcio",
}


class ProcedureStatus(str, Enum):
    em_andamento = "em_andamento"
    concluido = "concluido"
    cancelado = "cancelado"


class StageStatus(str, Enum):
    pendente = "pendente"
    em_andamento = "em_andamento"
    concluida = "concluida"


# As 8 etapas padrão de todo procedimento
STANDARD_STAGES: list[str] = [
    "Análise do caso concreto / conferência do checklist",
    "Elaboração da proposta de honorários/serviços",
    "Elaboração e assinatura do contrato de honorários",
    "Elaboração dos documentos necessários (requerimentos, declarações, revisão técnica)",
    "Orientação das partes quanto às assinaturas",
    "Prenotação dos documentos na Prefeitura e/ou cartório competente",
    "Saneamento das exigências",
    "Finalização e entrega do processo",
]


class Procedure(Base, UUIDMixin, TimestampMixin):
    """Cadastro do caso (protocolo)."""
    __tablename__ = "procedures"

    protocol_number: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    procedure_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    opened_at: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    property_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    matricula: Mapped[str | None] = mapped_column(String(100), nullable=True)
    incra: Mapped[str | None] = mapped_column(String(100), nullable=True)
    inscricao_imobiliaria: Mapped[str | None] = mapped_column(String(100), nullable=True)
    requerente: Mapped[str | None] = mapped_column(String(300), nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    tags: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=ProcedureStatus.em_andamento, index=True
    )
    responsible_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    attendance_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attendances.id", ondelete="SET NULL"), nullable=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="SET NULL"), nullable=True, index=True
    )

    client = relationship("Client", foreign_keys=[client_id])
    responsible = relationship("User", foreign_keys=[responsible_user_id])
    property: Mapped["Property | None"] = relationship(  # type: ignore[name-defined]
        "Property", back_populates="procedures", foreign_keys=[property_id]
    )
    checklist_items: Mapped[list["ChecklistItem"]] = relationship(  # type: ignore[name-defined]
        "ChecklistItem",
        primaryjoin="Procedure.id == foreign(ChecklistItem.procedure_id)",
        cascade="all, delete-orphan",
        order_by="ChecklistItem.order",
    )
    stages: Mapped[list["ProcedureStage"]] = relationship(
        "ProcedureStage",
        back_populates="procedure",
        cascade="all, delete-orphan",
        order_by="ProcedureStage.order",
    )


class ProcedureStage(Base, UUIDMixin, TimestampMixin):
    """Uma das 8 etapas de um procedimento."""
    __tablename__ = "procedure_stages"

    procedure_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=StageStatus.pendente, index=True
    )
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    procedure: Mapped["Procedure"] = relationship("Procedure", back_populates="stages")
    assigned_user = relationship("User", foreign_keys=[assigned_user_id])
