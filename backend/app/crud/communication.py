"""
CRUD — Módulo 9 Comunicações & Notificações
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.communication import (
    CHANNEL_LABELS,
    COMM_STATUS_LABELS,
    Communication,
    MessageTemplate,
    Notification,
)
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


# ── Template helpers ──────────────────────────────────────────────────────────

def _render_body(body: str, variables: dict[str, str]) -> str:
    """Substitui {{variavel}} no corpo com os valores fornecidos."""
    def replacer(m: re.Match) -> str:
        key = m.group(1).strip()
        return variables.get(key, m.group(0))
    return re.sub(r"\{\{([^}]+)\}\}", replacer, body)


def _template_to_read(t: MessageTemplate) -> TemplateRead:
    return TemplateRead(
        id=t.id,
        name=t.name,
        channel=t.channel,
        channel_label=CHANNEL_LABELS.get(t.channel, t.channel),
        subject=t.subject,
        body=t.body,
        variables=t.variables or [],
        is_active=t.is_active,
        created_by_id=t.created_by_id,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


# ── MessageTemplate CRUD ──────────────────────────────────────────────────────

async def create_template(
    db: AsyncSession, *, obj_in: TemplateCreate, created_by_id: uuid.UUID
) -> TemplateRead:
    t = MessageTemplate(
        name=obj_in.name,
        channel=obj_in.channel,
        subject=obj_in.subject,
        body=obj_in.body,
        variables=obj_in.variables,
        is_active=obj_in.is_active,
        created_by_id=created_by_id,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return _template_to_read(t)


async def get_template(db: AsyncSession, template_id: uuid.UUID) -> TemplateRead | None:
    row = await db.execute(
        sa.select(MessageTemplate).where(MessageTemplate.id == template_id)
    )
    t = row.scalar_one_or_none()
    return _template_to_read(t) if t else None


async def list_templates(
    db: AsyncSession, *, channel: Optional[str] = None, active_only: bool = True
) -> list[TemplateRead]:
    q = sa.select(MessageTemplate)
    if channel:
        q = q.where(MessageTemplate.channel == channel)
    if active_only:
        q = q.where(MessageTemplate.is_active.is_(True))
    q = q.order_by(MessageTemplate.name)
    rows = (await db.execute(q)).scalars().all()
    return [_template_to_read(t) for t in rows]


async def update_template(
    db: AsyncSession, template_id: uuid.UUID, obj_in: TemplateUpdate
) -> TemplateRead | None:
    row = await db.execute(
        sa.select(MessageTemplate).where(MessageTemplate.id == template_id)
    )
    t = row.scalar_one_or_none()
    if not t:
        return None
    for field, val in obj_in.model_dump(exclude_unset=True).items():
        setattr(t, field, val)
    await db.commit()
    await db.refresh(t)
    return _template_to_read(t)


async def delete_template(db: AsyncSession, template_id: uuid.UUID) -> bool:
    row = await db.execute(
        sa.select(MessageTemplate).where(MessageTemplate.id == template_id)
    )
    t = row.scalar_one_or_none()
    if not t:
        return False
    t.is_active = False
    await db.commit()
    return True


async def render_template(db: AsyncSession, req: RenderRequest) -> RenderResponse | None:
    tmpl = await get_template(db, req.template_id)
    if not tmpl:
        return None
    return RenderResponse(
        subject=_render_body(tmpl.subject, req.variables) if tmpl.subject else None,
        body=_render_body(tmpl.body, req.variables),
    )


# ── Communication CRUD ────────────────────────────────────────────────────────

def _comm_to_list(c: Communication) -> CommListItem:
    return CommListItem(
        id=c.id,
        channel=c.channel,
        channel_label=CHANNEL_LABELS.get(c.channel, c.channel),
        status=c.status,
        status_label=COMM_STATUS_LABELS.get(c.status, c.status),
        recipient_name=c.recipient_name,
        recipient_phone=c.recipient_phone,
        recipient_email=c.recipient_email,
        subject=c.subject,
        client_id=c.client_id,
        procedure_id=c.procedure_id,
        sent_at=c.sent_at,
        created_at=c.created_at,
    )


def _comm_to_read(c: Communication) -> CommRead:
    return CommRead(
        id=c.id,
        channel=c.channel,
        channel_label=CHANNEL_LABELS.get(c.channel, c.channel),
        status=c.status,
        status_label=COMM_STATUS_LABELS.get(c.status, c.status),
        recipient_name=c.recipient_name,
        recipient_phone=c.recipient_phone,
        recipient_email=c.recipient_email,
        subject=c.subject,
        body=c.body,
        template_id=c.template_id,
        client_id=c.client_id,
        procedure_id=c.procedure_id,
        provider_meta=c.provider_meta or {},
        sent_at=c.sent_at,
        error_message=c.error_message,
        created_by_id=c.created_by_id,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


async def create_communication(
    db: AsyncSession, *, obj_in: CommCreate, created_by_id: uuid.UUID
) -> CommRead:
    c = Communication(
        channel=obj_in.channel,
        status="pendente",
        recipient_name=obj_in.recipient_name,
        recipient_phone=obj_in.recipient_phone,
        recipient_email=obj_in.recipient_email,
        subject=obj_in.subject,
        body=obj_in.body,
        template_id=obj_in.template_id,
        client_id=obj_in.client_id,
        procedure_id=obj_in.procedure_id,
        provider_meta={},
        created_by_id=created_by_id,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _comm_to_read(c)


async def get_communication(db: AsyncSession, comm_id: uuid.UUID) -> CommRead | None:
    row = await db.execute(
        sa.select(Communication).where(Communication.id == comm_id)
    )
    c = row.scalar_one_or_none()
    return _comm_to_read(c) if c else None


async def list_communications(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 25,
    channel: Optional[str] = None,
    client_id: Optional[uuid.UUID] = None,
    procedure_id: Optional[uuid.UUID] = None,
) -> PaginatedComms:
    base = sa.select(Communication)
    if channel:
        base = base.where(Communication.channel == channel)
    if client_id:
        base = base.where(Communication.client_id == client_id)
    if procedure_id:
        base = base.where(Communication.procedure_id == procedure_id)

    total: int = (
        await db.execute(sa.select(sa.func.count()).select_from(base.subquery()))
    ).scalar_one()

    rows = (
        await db.execute(
            base.order_by(Communication.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return PaginatedComms(
        items=[_comm_to_list(c) for c in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)),
    )


async def mark_comm_status(
    db: AsyncSession,
    comm_id: uuid.UUID,
    status: str,
    *,
    error_message: Optional[str] = None,
    provider_meta: Optional[dict] = None,
) -> None:
    row = await db.execute(
        sa.select(Communication).where(Communication.id == comm_id)
    )
    c = row.scalar_one_or_none()
    if not c:
        return
    c.status = status
    if status == "enviado":
        c.sent_at = datetime.now(timezone.utc)
    if error_message is not None:
        c.error_message = error_message
    if provider_meta is not None:
        c.provider_meta = provider_meta
    await db.commit()


# ── Notification CRUD ─────────────────────────────────────────────────────────

def _notif_to_read(n: Notification) -> NotificationRead:
    return NotificationRead(
        id=n.id,
        recipient_id=n.recipient_id,
        title=n.title,
        body=n.body,
        link=n.link,
        tipo=n.tipo,
        is_read=n.is_read,
        read_at=n.read_at,
        created_at=n.created_at,
    )


async def create_notification(
    db: AsyncSession, *, obj_in: NotificationCreate
) -> NotificationRead:
    n = Notification(
        recipient_id=obj_in.recipient_id,
        title=obj_in.title,
        body=obj_in.body,
        link=obj_in.link,
        tipo=obj_in.tipo,
        is_read=False,
    )
    db.add(n)
    await db.commit()
    await db.refresh(n)
    return _notif_to_read(n)


async def list_notifications(
    db: AsyncSession,
    *,
    recipient_id: uuid.UUID,
    unread_only: bool = False,
    limit: int = 30,
) -> list[NotificationRead]:
    q = (
        sa.select(Notification)
        .where(Notification.recipient_id == recipient_id)
    )
    if unread_only:
        q = q.where(Notification.is_read.is_(False))
    q = q.order_by(Notification.created_at.desc()).limit(limit)
    rows = (await db.execute(q)).scalars().all()
    return [_notif_to_read(n) for n in rows]


async def unread_count(db: AsyncSession, *, recipient_id: uuid.UUID) -> int:
    result = await db.execute(
        sa.select(sa.func.count())
        .where(
            Notification.recipient_id == recipient_id,
            Notification.is_read.is_(False),
        )
    )
    return result.scalar_one()


async def mark_read(db: AsyncSession, notif_id: uuid.UUID, recipient_id: uuid.UUID) -> bool:
    row = await db.execute(
        sa.select(Notification).where(
            Notification.id == notif_id,
            Notification.recipient_id == recipient_id,
        )
    )
    n = row.scalar_one_or_none()
    if not n:
        return False
    n.is_read = True
    n.read_at = datetime.now(timezone.utc)
    await db.commit()
    return True


async def mark_all_read(db: AsyncSession, *, recipient_id: uuid.UUID) -> int:
    """Marca todas as notificações não lidas do usuário como lidas. Retorna a quantidade."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        sa.update(Notification)
        .where(
            Notification.recipient_id == recipient_id,
            Notification.is_read.is_(False),
        )
        .values(is_read=True, read_at=now)
    )
    await db.commit()
    return result.rowcount
