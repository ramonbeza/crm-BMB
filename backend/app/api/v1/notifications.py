import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, get_session
from app.core.security import decode_access_token
from app.core.ws_manager import ws_manager
from app.crud.notification import crud_notification

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class NotificationRead(BaseModel):
    id: uuid.UUID
    title: str
    body: str | None
    # Mapeamos o campo `tipo` do modelo para `notification_type` na API
    notification_type: str
    link: str | None
    read: bool
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_notif(cls, n) -> "NotificationRead":
        return cls(
            id=n.id,
            title=n.title,
            body=n.body,
            notification_type=n.tipo,
            link=n.link,
            read=n.is_read,
            created_at=n.created_at,
        )


# ── REST ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[NotificationRead])
async def list_notifications(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    unread_only: bool = False,
):
    items = await crud_notification.list_for_user(
        db, user_id=current_user.id, unread_only=unread_only, limit=60
    )
    return [NotificationRead.from_orm_notif(n) for n in items]


@router.get("/unread-count")
async def unread_count(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    count = await crud_notification.count_unread(db, user_id=current_user.id)
    return {"count": count}


@router.post("/{notification_id}/read", status_code=204)
async def mark_read(
    notification_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    await crud_notification.mark_read(
        db, notification_id=notification_id, user_id=current_user.id
    )


@router.post("/read-all", status_code=204)
async def mark_all_read(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    await crud_notification.mark_all_read(db, user_id=current_user.id)


# ── WebSocket ────────────────────────────────────────────────────────────────

@router.websocket("/ws")
async def notifications_ws(websocket: WebSocket):
    """
    WS: /api/v1/notifications/ws?token=<access_token>
    Envia {type:"notification"} quando uma nova notificação chega.
    """
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Token obrigatório")
        return

    try:
        payload = decode_access_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str or payload.get("type") != "access":
            raise ValueError("Token inválido")
        user_id = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        await websocket.close(code=4001, reason="Token inválido ou expirado")
        return

    await ws_manager.connect(websocket, user_id)
    try:
        await websocket.send_json({"type": "connected", "user_id": str(user_id)})
        while True:
            data = await websocket.receive_json()
            if data.get("action") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
