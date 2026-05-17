import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, field_validator

from app.models.client import ClientType


# ── PF ────────────────────────────────────────────────────────────────────────

class ClientPFData(BaseModel):
    name: str
    cpf: str
    birth_date: date | None = None
    civil_status: str | None = None
    rg: str | None = None
    cnh: str | None = None
    address: str | None = None

    @field_validator("cpf")
    @classmethod
    def cpf_format(cls, v: str) -> str:
        digits = "".join(c for c in v if c.isdigit())
        if len(digits) != 11:
            raise ValueError("CPF deve conter 11 dígitos")
        return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"


class ClientPFCreate(BaseModel):
    client_type: Literal[ClientType.PF] = ClientType.PF
    phone: str
    email: EmailStr | None = None
    notes: str | None = None
    pf_data: ClientPFData


class ClientPFUpdate(BaseModel):
    phone: str | None = None
    email: EmailStr | None = None
    notes: str | None = None
    pf_data: ClientPFData | None = None


class ClientPFRead(BaseModel):
    id: uuid.UUID
    client_type: str
    phone: str
    email: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    pf_data: ClientPFData | None

    model_config = {"from_attributes": True}


# ── PJ ────────────────────────────────────────────────────────────────────────

class ClientPJData(BaseModel):
    company_name: str
    cnpj: str
    address: str | None = None

    @field_validator("cnpj")
    @classmethod
    def cnpj_format(cls, v: str) -> str:
        digits = "".join(c for c in v if c.isdigit())
        if len(digits) != 14:
            raise ValueError("CNPJ deve conter 14 dígitos")
        return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"


class ClientPJCreate(BaseModel):
    client_type: Literal[ClientType.PJ] = ClientType.PJ
    phone: str
    email: EmailStr | None = None
    notes: str | None = None
    pj_data: ClientPJData


class ClientPJUpdate(BaseModel):
    phone: str | None = None
    email: EmailStr | None = None
    notes: str | None = None
    pj_data: ClientPJData | None = None


class ClientPJRead(BaseModel):
    id: uuid.UUID
    client_type: str
    phone: str
    email: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    pj_data: ClientPJData | None

    model_config = {"from_attributes": True}


# ── Genérico (para listagens) ─────────────────────────────────────────────────

class ClientListItem(BaseModel):
    id: uuid.UUID
    client_type: str
    phone: str
    email: str | None
    is_active: bool
    created_at: datetime
    # Nome display (nome PF ou razão social PJ)
    display_name: str
    document: str

    model_config = {"from_attributes": True}


class PaginatedClients(BaseModel):
    items: list[ClientListItem]
    total: int
    page: int
    page_size: int
    pages: int
