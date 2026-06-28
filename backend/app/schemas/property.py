from __future__ import annotations
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ProprietarioSchema(BaseModel):
    nome: str | None = None
    cpf: str | None = None
    cnpj: str | None = None
    nacionalidade: str | None = None
    estado_civil: str | None = None
    regime_bens: str | None = None
    profissao: str | None = None
    endereco: str | None = None


# ── ChecklistItem schemas ─────────────────────────────────────────────────────

class ChecklistItemRead(BaseModel):
    id: UUID
    procedure_id: UUID
    order: int
    name: str
    responsavel: str
    status: str
    notas: str | None
    received_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChecklistItemUpdate(BaseModel):
    status: str | None = None
    notas: str | None = None


class ChecklistItemCreate(BaseModel):
    name: str
    responsavel: str = "cliente"
    order: int


# ── PropertyClient schemas ────────────────────────────────────────────────────

class PropertyClientRead(BaseModel):
    id: UUID
    client_id: UUID
    role: str
    client_name: str | None = None
    client_document: str | None = None

    model_config = {"from_attributes": True}


class PropertyClientCreate(BaseModel):
    client_id: UUID
    role: str = "proprietario"


# ── Property schemas ──────────────────────────────────────────────────────────

class PropertyCreate(BaseModel):
    matricula: str | None = None
    inscricao_imobiliaria: str | None = None
    incra_code: str | None = None
    property_type: str = "urbano"
    subtipo: str | None = None
    endereco: str | None = None
    area_total: float | None = None
    area_unit: str = "m2"
    cartorio: str | None = None
    confrontantes: str | None = None
    proprietarios: list[dict[str, Any]] = Field(default_factory=list)
    quadro_areas_nbr: dict[str, Any] | None = None
    analise_juridica: dict[str, Any] | None = None
    notas: str | None = None
    owners: list[PropertyClientCreate] = Field(default_factory=list)


class PropertyUpdate(BaseModel):
    matricula: str | None = None
    inscricao_imobiliaria: str | None = None
    incra_code: str | None = None
    property_type: str | None = None
    subtipo: str | None = None
    endereco: str | None = None
    area_total: float | None = None
    area_unit: str | None = None
    cartorio: str | None = None
    confrontantes: str | None = None
    proprietarios: list[dict[str, Any]] | None = None
    notas: str | None = None


class PropertyRead(BaseModel):
    id: UUID
    matricula: str | None
    inscricao_imobiliaria: str | None
    incra_code: str | None
    property_type: str
    property_type_label: str
    subtipo: str | None
    endereco: str | None
    area_total: float | None
    area_unit: str
    cartorio: str | None
    confrontantes: str | None
    proprietarios: list[dict[str, Any]] = Field(default_factory=list)
    quadro_areas_nbr: dict[str, Any] | None = None
    analise_juridica: dict[str, Any] | None = None
    notas: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    owners: list[PropertyClientRead] = Field(default_factory=list)
    procedure_count: int = 0

    model_config = {"from_attributes": True}


class PropertyListItem(BaseModel):
    id: UUID
    matricula: str | None
    inscricao_imobiliaria: str | None
    property_type: str
    property_type_label: str
    endereco: str | None
    area_total: float | None
    area_unit: str
    cartorio: str | None
    is_active: bool
    procedure_count: int = 0
    owner_names: list[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class PaginatedProperties(BaseModel):
    items: list[PropertyListItem]
    total: int
    page: int
    page_size: int
    pages: int
