"""
Rotas — Módulo 9 Comunicações & Notificações
"""
from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import CurrentUser, InternalOnly, get_session
from app.crud import communication as crud
from app.schemas.communication import (
    CommCreate,
    CommListItem,
    CommRead,
    NotificationCreate,
    NotificationRead,
    PaginatedComms,
    RenderRequest,
    RenderResponse,
    TemplateCreate,
    TemplateRead,
    TemplateUpdate,
    UnreadCount,
)

router = APIRouter()


# ── Templates ─────────────────────────────────────────────────────────────────

@router.get("/templates/", response_model=list[TemplateRead])
async def list_templates(
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
    channel: Optional[str] = None,
    active_only: bool = True,
):
    return await crud.list_templates(db, channel=channel, active_only=active_only)


@router.post("/templates/", response_model=TemplateRead, status_code=201)
async def create_template(
    body: TemplateCreate,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await crud.create_template(db, obj_in=body, created_by_id=current_user.id)


@router.get("/templates/{template_id}", response_model=TemplateRead)
async def get_template(
    template_id: uuid.UUID,
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    t = await crud.get_template(db, template_id)
    if not t:
        raise HTTPException(404, "Template não encontrado")
    return t


@router.put("/templates/{template_id}", response_model=TemplateRead)
async def update_template(
    template_id: uuid.UUID,
    body: TemplateUpdate,
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    t = await crud.update_template(db, template_id, body)
    if not t:
        raise HTTPException(404, "Template não encontrado")
    return t


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(
    template_id: uuid.UUID,
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    ok = await crud.delete_template(db, template_id)
    if not ok:
        raise HTTPException(404, "Template não encontrado")


@router.post("/templates/render", response_model=RenderResponse)
async def render_template(
    body: RenderRequest,
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    result = await crud.render_template(db, body)
    if not result:
        raise HTTPException(404, "Template não encontrado")
    return result


# ── Communications (envio) ────────────────────────────────────────────────────

@router.get("/", response_model=PaginatedComms)
async def list_comms(
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    channel: Optional[str] = None,
    client_id: Optional[uuid.UUID] = None,
    procedure_id: Optional[uuid.UUID] = None,
):
    return await crud.list_communications(
        db,
        page=page,
        page_size=page_size,
        channel=channel,
        client_id=client_id,
        procedure_id=procedure_id,
    )


@router.post("/", response_model=CommRead, status_code=201)
async def send_message(
    body: CommCreate,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    """
    Cria um registro de comunicação e dispara o envio via Celery.
    - channel=whatsapp → usa Z-API (se configurado) ou Evolution API
    - channel=email    → usa SMTP
    """
    comm = await crud.create_communication(db, obj_in=body, created_by_id=current_user.id)

    # Dispatch async task
    from app.worker.tasks import send_email, send_whatsapp_evolution, send_whatsapp_zapi

    if body.channel == "email" and body.recipient_email:
        send_email.delay(
            str(comm.id),
            body.recipient_name,
            body.recipient_email,
            body.subject or "(sem assunto)",
            body.body,
        )
    elif body.channel == "whatsapp" and body.recipient_phone:
        if settings.ZAPI_INSTANCE_ID:
            send_whatsapp_zapi.delay(str(comm.id), body.recipient_phone, body.body)
        elif settings.EVOLUTION_API_URL:
            send_whatsapp_evolution.delay(str(comm.id), body.recipient_phone, body.body)
        else:
            # Provider não configurado: marca direto como falhou
            await crud.mark_comm_status(
                db, comm.id, "falhou",
                error_message="Nenhum provider WhatsApp configurado (ZAPI_INSTANCE_ID / EVOLUTION_API_URL)",
            )
            # Re-fetch para retornar status correto
            comm = await crud.get_communication(db, comm.id)

    return comm


@router.get("/{comm_id}", response_model=CommRead)
async def get_comm(
    comm_id: uuid.UUID,
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    c = await crud.get_communication(db, comm_id)
    if not c:
        raise HTTPException(404, "Comunicação não encontrada")
    return c


# ── Notifications ─────────────────────────────────────────────────────────────

@router.get("/notifications/", response_model=list[NotificationRead])
async def list_notifications(
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
    unread_only: bool = False,
    limit: int = Query(30, ge=1, le=100),
):
    return await crud.list_notifications(
        db, recipient_id=current_user.id, unread_only=unread_only, limit=limit
    )


@router.get("/notifications/unread-count", response_model=UnreadCount)
async def get_unread_count(
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    count = await crud.unread_count(db, recipient_id=current_user.id)
    return UnreadCount(count=count)


@router.post("/notifications/mark-all-read", response_model=UnreadCount)
async def mark_all_read(
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    count = await crud.mark_all_read(db, recipient_id=current_user.id)
    return UnreadCount(count=count)


@router.post("/notifications/{notif_id}/read", status_code=204)
async def mark_read(
    notif_id: uuid.UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    ok = await crud.mark_read(db, notif_id, current_user.id)
    if not ok:
        raise HTTPException(404, "Notificação não encontrada")


# ── Internal: criar notificação (ex: chamado por hooks futuros) ───────────────

@router.post("/notifications/", response_model=NotificationRead, status_code=201)
async def create_notification(
    body: NotificationCreate,
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await crud.create_notification(db, obj_in=body)
