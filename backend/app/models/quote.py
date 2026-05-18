"""
Módulo 5 — Orçamentos e Contratos de Honorários
"""
from __future__ import annotations

import enum

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class QuoteStatus(str, enum.Enum):
    rascunho = "rascunho"
    enviado = "enviado"
    aguardando_assinatura = "aguardando_assinatura"
    assinado = "assinado"
    cancelado = "cancelado"
    expirado = "expirado"


QUOTE_STATUS_LABELS: dict[str, str] = {
    "rascunho": "Rascunho",
    "enviado": "Enviado",
    "aguardando_assinatura": "Aguardando assinatura",
    "assinado": "Assinado",
    "cancelado": "Cancelado",
    "expirado": "Expirado",
}


class ContractStatus(str, enum.Enum):
    rascunho = "rascunho"
    enviado = "enviado"
    aguardando_assinatura = "aguardando_assinatura"
    assinado = "assinado"
    cancelado = "cancelado"


class PaymentModel(str, enum.Enum):
    fixo = "fixo"
    parcelado = "parcelado"
    exito = "exito"
    fixo_mais_exito = "fixo_mais_exito"
    a_definir = "a_definir"


PAYMENT_MODEL_LABELS: dict[str, str] = {
    "fixo": "Valor fixo",
    "parcelado": "Parcelado com vencimentos",
    "exito": "Êxito",
    "fixo_mais_exito": "Fixo + Êxito",
    "a_definir": "A definir",
}


class Quote(UUIDMixin, TimestampMixin, Base):
    """Orçamento de honorários — BMB-ORC-YYYY-0001."""
    __tablename__ = "quotes"

    quote_number: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    quote_year: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    version: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=1)

    procedure_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("procedures.id", ondelete="SET NULL"), nullable=True, index=True
    )
    client_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    procedure_type: Mapped[str | None] = mapped_column(sa.String(40), nullable=True)

    status: Mapped[str] = mapped_column(
        sa.String(30), nullable=False, default=QuoteStatus.rascunho, index=True
    )

    # Composição de valores
    honorarios_escritorio: Mapped[float] = mapped_column(sa.Numeric(12, 2), nullable=False, default=0)
    honorarios_despachante: Mapped[float] = mapped_column(sa.Numeric(12, 2), nullable=False, default=0)
    # custas_estimadas: [{name: str, value: float}]
    custas_estimadas: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    desconto: Mapped[float] = mapped_column(sa.Numeric(12, 2), nullable=False, default=0)
    desconto_motivo: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    valid_until: Mapped[sa.Date | None] = mapped_column(sa.Date, nullable=True)
    notas: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    sent_at: Mapped[sa.DateTime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    signed_at: Mapped[sa.DateTime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)

    created_by_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    parent_quote_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    client = relationship("Client", foreign_keys=[client_id])
    procedure = relationship("Procedure", foreign_keys=[procedure_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    contracts: Mapped[list["Contract"]] = relationship(
        "Contract", back_populates="quote", cascade="all, delete-orphan"
    )


class Contract(UUIDMixin, TimestampMixin, Base):
    """Contrato de honorários — BMB-CTR-YYYY-0001."""
    __tablename__ = "contracts"

    contract_number: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    contract_year: Mapped[int] = mapped_column(sa.Integer, nullable=False)

    quote_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    procedure_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("procedures.id", ondelete="SET NULL"), nullable=True, index=True
    )
    client_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )

    status: Mapped[str] = mapped_column(
        sa.String(30), nullable=False, default=ContractStatus.rascunho, index=True
    )
    payment_model: Mapped[str] = mapped_column(
        sa.String(20), nullable=False, default=PaymentModel.a_definir
    )
    total_value: Mapped[float] = mapped_column(sa.Numeric(12, 2), nullable=False, default=0)
    # installments: [{due_date, value, status: pendente|pago}]
    installments: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    exito_percentual: Mapped[float | None] = mapped_column(sa.Numeric(5, 2), nullable=True)

    signed_at: Mapped[sa.DateTime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    signed_document_path: Mapped[str | None] = mapped_column(sa.String(500), nullable=True)
    notas: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    created_by_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    quote: Mapped["Quote | None"] = relationship("Quote", back_populates="contracts")
    client = relationship("Client", foreign_keys=[client_id])
    procedure = relationship("Procedure", foreign_keys=[procedure_id])
    created_by = relationship("User", foreign_keys=[created_by_id])


class PriceTableEntry(UUIDMixin, TimestampMixin, Base):
    """Tabela de preços padrão por tipo de procedimento."""
    __tablename__ = "price_table"

    procedure_type: Mapped[str] = mapped_column(sa.String(40), nullable=False, unique=True)
    base_honorarios: Mapped[float] = mapped_column(sa.Numeric(12, 2), nullable=False, default=0)
    base_despachante: Mapped[float] = mapped_column(sa.Numeric(12, 2), nullable=False, default=0)
    # custas_tipicas: [{name, value}]
    custas_tipicas: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    notas: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
