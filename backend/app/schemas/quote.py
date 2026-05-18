from __future__ import annotations
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ── CustaItem ─────────────────────────────────────────────────────────────────

class CustaItem(BaseModel):
    name: str
    value: float


# ── Quote ─────────────────────────────────────────────────────────────────────

class QuoteCreate(BaseModel):
    client_id: UUID
    procedure_id: UUID | None = None
    procedure_type: str | None = None
    honorarios_escritorio: float = 0
    honorarios_despachante: float = 0
    custas_estimadas: list[CustaItem] = Field(default_factory=list)
    desconto: float = 0
    desconto_motivo: str | None = None
    valid_until: date | None = None
    notas: str | None = None


class QuoteUpdate(BaseModel):
    honorarios_escritorio: float | None = None
    honorarios_despachante: float | None = None
    custas_estimadas: list[CustaItem] | None = None
    desconto: float | None = None
    desconto_motivo: str | None = None
    valid_until: date | None = None
    notas: str | None = None
    status: str | None = None
    procedure_type: str | None = None


class QuoteRead(BaseModel):
    id: UUID
    quote_number: int
    quote_year: int
    version: int
    formatted_number: str
    procedure_id: UUID | None
    client_id: UUID
    client_name: str | None
    procedure_type: str | None
    procedure_type_label: str | None
    status: str
    status_label: str
    honorarios_escritorio: float
    honorarios_despachante: float
    custas_estimadas: list[CustaItem]
    custas_total: float
    desconto: float
    desconto_motivo: str | None
    subtotal: float
    total: float
    valid_until: date | None
    notas: str | None
    sent_at: datetime | None
    signed_at: datetime | None
    created_by_id: UUID | None
    parent_quote_id: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class QuoteListItem(BaseModel):
    id: UUID
    formatted_number: str
    version: int
    client_id: UUID
    client_name: str | None
    procedure_id: UUID | None
    procedure_type_label: str | None
    status: str
    status_label: str
    total: float
    valid_until: date | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedQuotes(BaseModel):
    items: list[QuoteListItem]
    total: int
    page: int
    page_size: int
    pages: int


# ── Contract ──────────────────────────────────────────────────────────────────

class InstallmentItem(BaseModel):
    due_date: str  # ISO date string
    value: float
    status: str = "pendente"  # pendente | pago


class ContractCreate(BaseModel):
    client_id: UUID
    quote_id: UUID | None = None
    procedure_id: UUID | None = None
    payment_model: str = "a_definir"
    total_value: float = 0
    installments: list[InstallmentItem] = Field(default_factory=list)
    exito_percentual: float | None = None
    notas: str | None = None


class ContractUpdate(BaseModel):
    status: str | None = None
    payment_model: str | None = None
    total_value: float | None = None
    installments: list[InstallmentItem] | None = None
    exito_percentual: float | None = None
    notas: str | None = None


class ContractRead(BaseModel):
    id: UUID
    contract_number: int
    contract_year: int
    formatted_number: str
    quote_id: UUID | None
    procedure_id: UUID | None
    client_id: UUID
    client_name: str | None
    status: str
    status_label: str
    payment_model: str
    payment_model_label: str
    total_value: float
    installments: list[InstallmentItem]
    exito_percentual: float | None
    signed_at: datetime | None
    notas: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContractListItem(BaseModel):
    id: UUID
    formatted_number: str
    client_id: UUID
    client_name: str | None
    procedure_id: UUID | None
    status: str
    status_label: str
    payment_model_label: str
    total_value: float
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedContracts(BaseModel):
    items: list[ContractListItem]
    total: int
    page: int
    page_size: int
    pages: int


# ── PriceTable ────────────────────────────────────────────────────────────────

class PriceTableRead(BaseModel):
    id: UUID
    procedure_type: str
    procedure_type_label: str
    base_honorarios: float
    base_despachante: float
    custas_tipicas: list[CustaItem]
    notas: str | None

    model_config = {"from_attributes": True}


class PriceTableUpdate(BaseModel):
    base_honorarios: float | None = None
    base_despachante: float | None = None
    custas_tipicas: list[CustaItem] | None = None
    notas: str | None = None
