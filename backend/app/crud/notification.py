from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.communication import Notification


class CRUDNotification:
    async def create(
        self,
        db: AsyncSession,
        *,
        user_id: UUID,
        title: str,
        body: str | None = None,
        tipo: str = "info",
        link: str | None = None,
    ) -> Notification:
        n = Notification(
            recipient_id=user_id,
            title=title,
            body=body,
            tipo=tipo,
            link=link,
        )
        db.add(n)
        await db.flush()
        return n

    async def list_for_user(
        self,
        db: AsyncSession,
        *,
        user_id: UUID,
        unread_only: bool = False,
        limit: int = 60,
    ) -> list[Notification]:
        q = select(Notification).where(Notification.recipient_id == user_id)
        if unread_only:
            q = q.where(Notification.is_read == False)
        q = q.order_by(Notification.created_at.desc()).limit(limit)
        res = await db.execute(q)
        return list(res.scalars().all())

    async def count_unread(self, db: AsyncSession, *, user_id: UUID) -> int:
        res = await db.execute(
            select(func.count()).select_from(Notification).where(
                Notification.recipient_id == user_id,
                Notification.is_read == False,
            )
        )
        return res.scalar_one()

    async def mark_read(self, db: AsyncSession, *, notification_id: UUID, user_id: UUID) -> None:
        await db.execute(
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.recipient_id == user_id,
            )
            .values(is_read=True, read_at=datetime.now(timezone.utc))
        )

    async def mark_all_read(self, db: AsyncSession, *, user_id: UUID) -> None:
        await db.execute(
            update(Notification)
            .where(Notification.recipient_id == user_id, Notification.is_read == False)
            .values(is_read=True, read_at=datetime.now(timezone.utc))
        )


crud_notification = CRUDNotification()
