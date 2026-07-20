import math
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.base import CRUDBase
from app.models.client import Client, ClientType
from app.models.meeting import MEETING_CATEGORY_LABELS, Meeting
from app.models.user import User
from app.schemas.meeting import MeetingCreate, MeetingRead, MeetingUpdate, PaginatedMeetings


def _client_display(client: Client | None) -> str | None:
    if client is None:
        return None
    if client.client_type == ClientType.PF and client.pf_data:
        return client.pf_data.name
    if client.client_type == ClientType.PJ and client.pj_data:
        return client.pj_data.company_name
    return None


class CRUDMeeting(CRUDBase[Meeting]):
    def _q(self):
        return select(Meeting).options(
            selectinload(Meeting.client).selectinload(Client.pf_data),
            selectinload(Meeting.client).selectinload(Client.pj_data),
            selectinload(Meeting.user),
        )

    async def get_full(self, db: AsyncSession, id: UUID) -> Meeting | None:
        res = await db.execute(self._q().where(Meeting.id == id))
        return res.scalar_one_or_none()

    def _to_read(self, m: Meeting) -> MeetingRead:
        return MeetingRead(
            id=m.id,
            client_id=m.client_id,
            user_id=m.user_id,
            meeting_category=m.meeting_category,
            meeting_category_label=MEETING_CATEGORY_LABELS.get(m.meeting_category),
            scheduled_at=m.scheduled_at,
            duration_minutes=m.duration_minutes,
            reception_type=m.reception_type,
            subject=m.subject,
            summary=m.summary,
            status=m.status,
            recurrence_type=m.recurrence_type,
            recurrence_days=m.recurrence_days,
            recurrence_end_date=m.recurrence_end_date,
            created_at=m.created_at,
            updated_at=m.updated_at,
            client_name=_client_display(m.client) if m.client else None,
            user_name=m.user.name if m.user else None,
        )

    async def create_meeting(
        self, db: AsyncSession, *, obj_in: MeetingCreate, created_by_id: UUID
    ) -> MeetingRead:
        m = Meeting(
            client_id=obj_in.client_id,
            user_id=obj_in.user_id,
            meeting_category=obj_in.meeting_category,
            scheduled_at=obj_in.scheduled_at,
            duration_minutes=obj_in.duration_minutes,
            reception_type=obj_in.reception_type,
            subject=obj_in.subject,
            summary=obj_in.summary,
            status=obj_in.status,
            recurrence_type=obj_in.recurrence_type,
            recurrence_days=obj_in.recurrence_days,
            recurrence_end_date=obj_in.recurrence_end_date,
            created_by_id=created_by_id,
        )
        db.add(m)
        await db.flush()
        return self._to_read(await self.get_full(db, m.id))

    async def update_meeting(
        self, db: AsyncSession, *, db_obj: Meeting, obj_in: MeetingUpdate
    ) -> MeetingRead:
        updatable = (
            "client_id", "user_id", "meeting_category", "scheduled_at",
            "duration_minutes", "reception_type", "subject", "summary", "status",
            "recurrence_type", "recurrence_days", "recurrence_end_date",
        )
        for field in updatable:
            val = getattr(obj_in, field)
            if val is not None:
                setattr(db_obj, field, val)
        db.add(db_obj)
        await db.flush()
        return self._to_read(await self.get_full(db, db_obj.id))

    async def list_paginated(
        self,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 50,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        user_id: UUID | None = None,
        client_id: UUID | None = None,
    ) -> PaginatedMeetings:
        q = self._q()
        if date_from:
            q = q.where(Meeting.scheduled_at >= date_from)
        if date_to:
            q = q.where(Meeting.scheduled_at <= date_to)
        if user_id:
            q = q.where(Meeting.user_id == user_id)
        if client_id:
            q = q.where(Meeting.client_id == client_id)

        total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
        offset = (page - 1) * page_size
        res = await db.execute(q.order_by(Meeting.scheduled_at).offset(offset).limit(page_size))
        items = [self._to_read(m) for m in res.scalars().unique().all()]
        return PaginatedMeetings(
            items=items, total=total, page=page, page_size=page_size,
            pages=math.ceil(total / page_size) if total else 0,
        )


crud_meeting = CRUDMeeting(Meeting)
