"""
Schemas Pydantic — Módulo 9 Comunicações & Notificações
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── MessageTemplate ───────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    channel: str = Field(..., description="whatsapp | email | interno")
    subject: Optional[str] = Field(None, max_length=300)
    body: str = Field(..., min_length=1)
    variables: list[str] = Field(default_factory=list,
                                  description="Nomes das variáveis, ex: ['nome_cliente', 'numero_processo']")
    is_active: bool = True


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    channel: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    variables: Optional[list[str]] = None
    is_active: Optional[bool] = None


class TemplateRead(BaseModel):
    id: UUID
    name: str
    channel: str
    channel_label: str
    subject: Optional[str]
    body: str
    variables: list[str]
    is_active: bool
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Communication ─────────────────────────────────────────────────────────────

class CommCreate(BaseModel):
    channel: str = Field(..., description="whatsapp | email")
    recipient_name: Optional[str] = None
    recipient_phone: Optional[str] = Field(None, description="Número com DDI, ex: 5511999999999")
    recipient_email: Optional[str] = None
    subject: Optional[str] = None   # email only
    body: str = Field(..., min_length=1)
    template_id: Optional[UUID] = None
    client_id: Optional[UUID] = None
    procedure_id: Optional[UUID] = None


class CommRead(BaseModel):
    id: UUID
    channel: str
    channel_label: str
    status: str
    status_label: str
    recipient_name: Optional[str]
    recipient_phone: Optional[str]
    recipient_email: Optional[str]
    subject: Optional[str]
    body: str
    template_id: Optional[UUID]
    client_id: Optional[UUID]
    procedure_id: Optional[UUID]
    provider_meta: dict[str, Any]
    sent_at: Optional[datetime]
    error_message: Optional[str]
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CommListItem(BaseModel):
    id: UUID
    channel: str
    channel_label: str
    status: str
    status_label: str
    recipient_name: Optional[str]
    recipient_phone: Optional[str]
    recipient_email: Optional[str]
    subject: Optional[str]
    client_id: Optional[UUID]
    procedure_id: Optional[UUID]
    sent_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedComms(BaseModel):
    items: list[CommListItem]
    total: int
    page: int
    page_size: int
    pages: int


# ── Notification ──────────────────────────────────────────────────────────────

class NotificationCreate(BaseModel):
    recipient_id: UUID
    title: str = Field(..., min_length=1, max_length=200)
    body: Optional[str] = None
    link: Optional[str] = None
    tipo: str = Field("info", description="info | sucesso | aviso | erro")


class NotificationRead(BaseModel):
    id: UUID
    recipient_id: UUID
    title: str
    body: Optional[str]
    link: Optional[str]
    tipo: str
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class UnreadCount(BaseModel):
    count: int


# ── Template variable rendering ───────────────────────────────────────────────

class RenderRequest(BaseModel):
    template_id: UUID
    variables: dict[str, str] = Field(
        default_factory=dict,
        description="Valores para substituição, ex: {'nome_cliente': 'João Silva'}"
    )


class RenderResponse(BaseModel):
    subject: Optional[str]
    body: str
