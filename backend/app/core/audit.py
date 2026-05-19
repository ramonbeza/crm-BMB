"""
Utilitário de auditoria — registra ações críticas de forma assíncrona.

Uso nas rotas:
    from app.core.audit import audit
    await audit(db, request, user, "procedure.status_changed",
                entity_type="procedure", entity_id=str(proc_id),
                details={"old": "em_andamento", "new": "concluido"})
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import Request
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.models.user import User

from app.models.audit import AuditLog


async def audit(
    db: "AsyncSession",
    request: "Request | None",
    user: "User | None",
    action: str,
    *,
    entity_type: str | None = None,
    entity_id: str | None = None,
    details: dict | None = None,
) -> None:
    """
    Grava uma linha de auditoria. Fire-and-forget — nunca lança exceção.
    """
    try:
        ip = None
        ua = None
        if request:
            # X-Forwarded-For (nginx reverse proxy)
            forwarded = request.headers.get("x-forwarded-for")
            ip = (forwarded.split(",")[0].strip() if forwarded
                  else request.client.host if request.client else None)
            ua = request.headers.get("user-agent", "")[:300]

        log = AuditLog(
            user_id=user.id if user else None,
            user_email=user.email if user else None,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None,
            details=details,
            ip_address=ip,
            user_agent=ua,
        )
        db.add(log)
        # Não damos flush aqui — o commit da transação principal salva junto.
        # Se a transação for revertida, o log também é revertido (comportamento correto).
    except Exception:
        pass  # Auditoria nunca deve quebrar o fluxo principal
