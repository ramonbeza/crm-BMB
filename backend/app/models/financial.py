"""
Módulo 8 — Gestão Financeira
Registros de custas reais, repasses ao despachante e recebimentos de honorários.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class EntryTipo(str, enum.Enum):
    custa_real = "custa_real"                    # Custo incorrido (escritório paga)
    repasse_despachante = "repasse_despachante"  # Repasse à empresa despachante
    honorario_recebido = "honorario_recebido"    # Honorário efetivamente recebido do cliente


class EntryStatus(str, enum.Enum):
    pendente = "pendente"
    pago = "pago"
    cancelado = "cancelado"


class EntryCategory(str, enum.Enum):
    cartorio = "cartorio"
    imposto = "imposto"
    taxa = "taxa"
    diligencia = "diligencia"
    despachante = "despachante"
    honorario = "honorario"
    outro = "outro"


ENTRY_TIPO_LABELS: dict[str, str] = {
    "custa_real": "Custa real",
    "repasse_despachante": "Repasse ao despachante",
    "honorario_recebido": "Honorário recebido",
}

ENTRY_STATUS_LABELS: dict[str, str] = {
    "pendente": "Pendente",
    "pago": "Pago",
    "cancelado": "Cancelado",
}

ENTRY_CATEGORY_LABELS: dict[str, str] = {
    "cartorio": "Cartório",
    "imposto": "Imposto",
    "taxa": "Taxa",
    "diligencia": "Diligência",
    "despachante": "Despachante",
    "honorario": "Honorário",
    "outro": "Outro",
}


class FinancialEntry(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "financial_entries"

    # Número sequencial (apenas para repasses — gera BMB-REP-YYYY-0001)
    entry_number: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    entry_year: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)

    # Vínculos (pelo menos um deve ser preenchido)
    procedure_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("procedures.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("contracts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Classificação
    tipo: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    category: Mapped[str] = mapped_column(sa.String(50), nullable=False, server_default="outro")
    description: Mapped[str] = mapped_column(sa.String(500), nullable=False)

    # Valor e estado
    value: Mapped[Decimal] = mapped_column(sa.Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default="pendente")
    due_date: Mapped[date | None] = mapped_column(sa.Date, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)

    notas: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Relacionamentos (somente leitura — para joins na listagem)
    procedure: Mapped["Procedure | None"] = relationship(  # type: ignore[name-defined]
        "Procedure", foreign_keys=[procedure_id], lazy="select"
    )
    contract: Mapped["Contract | None"] = relationship(  # type: ignore[name-defined]
        "Contract", foreign_keys=[contract_id], lazy="select"
    )
    created_by: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[created_by_id], lazy="select"
    )
