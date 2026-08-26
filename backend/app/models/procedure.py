import uuid
from datetime import date, datetime
from enum import Enum

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

# Importado explicitamente para garantir que o mapper do SQLAlchemy consiga
# resolver relationship("User") nos modelos abaixo, independente da ordem de import.
from app.models.user import User  # noqa: F401


class ProcedureType(str, Enum):
    # ── Despachante imobiliário ────────────────────────────────────────────────
    transferencia_imovel = "transferencia_imovel"
    compra_venda = "compra_venda"
    doacao_imovel = "doacao_imovel"
    permuta = "permuta"
    divisao_amigavel = "divisao_amigavel"
    unificacao_matriculas = "unificacao_matriculas"
    averbacao = "averbacao"
    regularizacao_imovel = "regularizacao_imovel"
    # ── Registral / Notarial ───────────────────────────────────────────────────
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
    # ── Despachante imobiliário ────────────────────────────────────────────────
    "transferencia_imovel": "Transferência de Imóvel (ITBI + Escritura + Registro)",
    "compra_venda": "Compra e Venda",
    "doacao_imovel": "Doação de Imóvel",
    "permuta": "Permuta",
    "divisao_amigavel": "Divisão Amigável",
    "unificacao_matriculas": "Unificação de Matrículas",
    "averbacao": "Averbação",
    "regularizacao_imovel": "Regularização de Imóvel",
    # ── Registral / Notarial ───────────────────────────────────────────────────
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


class ProcedureTypeCatalog(Base, UUIDMixin, TimestampMixin):
    """Catálogo de tipos de procedimento — editável por admin/advogado na tela de Procedimentos."""
    __tablename__ = "procedure_types"

    code: Mapped[str] = mapped_column(String(60), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


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
    executor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
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
    executor = relationship("User", foreign_keys=[executor_user_id])
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


class ProcedureTransfer(Base, UUIDMixin, TimestampMixin):
    """Histórico de transferências de responsável."""
    __tablename__ = "procedure_transfers"

    procedure_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    to_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=False
    )
    transferred_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    procedure = relationship("Procedure", foreign_keys=[procedure_id])
    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])
    transferred_by = relationship("User", foreign_keys=[transferred_by_id])


class ProcedureComment(Base, UUIDMixin, TimestampMixin):
    """Notas internas de equipe em um procedimento."""
    __tablename__ = "procedure_comments"

    procedure_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    procedure = relationship("Procedure", foreign_keys=[procedure_id])
    author = relationship("User", foreign_keys=[author_id])


class ProcedureTask(Base, UUIDMixin, TimestampMixin):
    """Tarefas internas dentro de um procedimento."""
    __tablename__ = "procedure_tasks"

    procedure_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pendente", index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    procedure = relationship("Procedure", foreign_keys=[procedure_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    created_by = relationship("User", foreign_keys=[created_by_id])


class ProcedureAttachment(Base, UUIDMixin, TimestampMixin):
    """Arquivos anexados a um procedimento (armazenados no MinIO)."""
    __tablename__ = "procedure_attachments"

    procedure_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    storage_key: Mapped[str] = mapped_column(String(1000), nullable=False)

    procedure = relationship("Procedure", foreign_keys=[procedure_id])
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])
