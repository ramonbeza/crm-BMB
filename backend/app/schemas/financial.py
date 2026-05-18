"""
Schemas Pydantic — Módulo 8 Financeiro
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── Enums / choices ───────────────────────────────────────────────────────────

TIPO_CHOICES = ["custa_real", "repasse_despachante", "honorario_recebido"]
STATUS_CHOICES = ["pendente", "pago", "cancelado"]
CATEGORY_CHOICES = ["cartorio", "imposto", "taxa", "diligencia", "despachante", "honorario", "outro"]


# ── Create / Update ───────────────────────────────────────────────────────────

class FinancialEntryCreate(BaseModel):
    procedure_id: Optional[UUID] = None
    contract_id: Optional[UUID] = None
    client_id: Optional[UUID] = None

    tipo: str = Field(..., description="custa_real | repasse_despachante | honorario_recebido")
    category: str = Field("outro", description="cartorio | imposto | taxa | diligencia | despachante | honorario | outro")
    description: str = Field(..., min_length=1, max_length=500)

    value: Decimal = Field(..., ge=0)
    status: str = Field("pendente", description="pendente | pago | cancelado")
    due_date: Optional[date] = None
    paid_at: Optional[datetime] = None

    notas: Optional[str] = None


class FinancialEntryUpdate(BaseModel):
    tipo: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    value: Optional[Decimal] = None
    status: Optional[str] = None
    due_date: Optional[date] = None
    paid_at: Optional[datetime] = None
    notas: Optional[str] = None
    procedure_id: Optional[UUID] = None
    contract_id: Optional[UUID] = None
    client_id: Optional[UUID] = None


# ── Read ──────────────────────────────────────────────────────────────────────

class FinancialEntryRead(BaseModel):
    id: UUID
    entry_number: Optional[int]
    entry_year: Optional[int]
    formatted_number: Optional[str]  # BMB-REP-YYYY-0001 (apenas para repasses)

    procedure_id: Optional[UUID]
    procedure_number: Optional[str]  # formatted protocol number
    contract_id: Optional[UUID]
    contract_number: Optional[str]   # formatted contract number
    client_id: Optional[UUID]
    client_name: Optional[str]

    tipo: str
    tipo_label: str
    category: str
    category_label: str
    description: str

    value: Decimal
    status: str
    status_label: str
    due_date: Optional[date]
    paid_at: Optional[datetime]

    notas: Optional[str]
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FinancialEntryListItem(BaseModel):
    id: UUID
    formatted_number: Optional[str]
    tipo: str
    tipo_label: str
    category: str
    category_label: str
    description: str
    value: Decimal
    status: str
    status_label: str
    due_date: Optional[date]
    paid_at: Optional[datetime]
    procedure_id: Optional[UUID]
    procedure_number: Optional[str]
    contract_id: Optional[UUID]
    client_id: Optional[UUID]
    client_name: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedFinancialEntries(BaseModel):
    items: list[FinancialEntryListItem]
    total: int
    page: int
    page_size: int
    pages: int


# ── Financial summary (per procedure) ────────────────────────────────────────

class ProcedureFinancialSummary(BaseModel):
    """Resumo financeiro de um procedimento específico."""
    procedure_id: UUID

    # Do orçamento (estimado)
    quote_id: Optional[UUID]
    honorarios_escritorio_orcado: Decimal
    honorarios_despachante_orcado: Decimal
    custas_estimadas_total: Decimal
    total_orcado: Decimal

    # Realizado
    custas_reais_pagas: Decimal
    custas_reais_pendentes: Decimal
    repasses_pagos: Decimal
    repasses_pendentes: Decimal
    honorarios_recebidos: Decimal

    # Parcelas do contrato (resumo)
    contract_id: Optional[UUID]
    total_contrato: Decimal
    parcelas_pagas: Decimal
    parcelas_pendentes: Decimal

    # Delta custas (real - estimado)
    variacao_custas: Decimal   # positivo = acima do orçado


# ── Dashboard summary (global) ────────────────────────────────────────────────

class FinancialDashboard(BaseModel):
    """Resumo financeiro geral para o dashboard."""
    # Honorários (contratos)
    honorarios_a_receber: Decimal       # parcelas pendentes de todos os contratos
    honorarios_recebidos_mes: Decimal   # pagos no mês corrente

    # Custas reais
    custas_pendentes: Decimal
    custas_pagas_mes: Decimal

    # Repasses
    repasses_pendentes: Decimal
    repasses_pagos_mes: Decimal

    # Entries com vencimento próximo (7 dias)
    vencimentos_proximos: list[FinancialEntryListItem]
    # Entries em atraso
    em_atraso: list[FinancialEntryListItem]
