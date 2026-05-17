import math
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.base import CRUDBase
from app.models.client import Client, ClientType
from app.models.meeting import Attendance, Meeting
from app.schemas.attendance import (
    AttendanceCreate,
    AttendanceFromMeeting,
    AttendanceRead,
    AttendanceUpdate,
    PaginatedAttendances,
)


def _client_display(client: Client | None) -> str | None:
    if client is None:
        return None
    if client.client_type == ClientType.PF and client.pf_data:
        return client.pf_data.name
    if client.client_type == ClientType.PJ and client.pj_data:
        return client.pj_data.company_name
    return None


class CRUDAttendance(CRUDBase[Attendance]):
    def _q(self):
        return select(Attendance).options(
            selectinload(Attendance.client).selectinload(Client.pf_data),
            selectinload(Attendance.client).selectinload(Client.pj_data),
            selectinload(Attendance.user),
            selectinload(Attendance.meeting),
        )

    async def get_full(self, db: AsyncSession, id: UUID) -> Attendance | None:
        res = await db.execute(self._q().where(Attendance.id == id))
        return res.scalar_one_or_none()

    def _to_read(self, a: Attendance) -> AttendanceRead:
        return AttendanceRead(
            id=a.id,
            meeting_id=a.meeting_id,
            client_id=a.client_id,
            user_id=a.user_id,
            decisions=a.decisions,
            pending_items=a.pending_items,
            converted_to_procedure=a.converted_to_procedure,
            created_at=a.created_at,
            updated_at=a.updated_at,
            client_name=_client_display(a.client),
            user_name=a.user.name if a.user else None,
            meeting_subject=a.meeting.subject if a.meeting else None,
        )

    async def create_attendance(
        self, db: AsyncSession, *, obj_in: AttendanceCreate, created_by_id: UUID
    ) -> AttendanceRead:
        a = Attendance(
            meeting_id=obj_in.meeting_id,
            client_id=obj_in.client_id,
            user_id=obj_in.user_id,
            decisions=obj_in.decisions,
            pending_items=obj_in.pending_items,
            converted_to_procedure=obj_in.converted_to_procedure,
            created_by_id=created_by_id,
        )
        db.add(a)
        await db.flush()
        return self._to_read(await self.get_full(db, a.id))

    async def create_from_meeting(
        self, db: AsyncSession, *, obj_in: AttendanceFromMeeting, meeting: Meeting, created_by_id: UUID
    ) -> AttendanceRead:
        a = Attendance(
            meeting_id=meeting.id,
            client_id=meeting.client_id,
            user_id=meeting.user_id,
            decisions=obj_in.decisions,
            pending_items=obj_in.pending_items,
            created_by_id=created_by_id,
        )
        db.add(a)
        await db.flush()
        return self._to_read(await self.get_full(db, a.id))

    async def update_attendance(
        self, db: AsyncSession, *, db_obj: Attendance, obj_in: AttendanceUpdate
    ) -> AttendanceRead:
        for field in ("meeting_id", "client_id", "user_id", "decisions", "pending_items", "converted_to_procedure"):
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
        pending_only: bool = False,
        client_id: UUID | None = None,
    ) -> PaginatedAttendances:
        q = self._q()
        if pending_only:
            # "pendentes de virar procedimento": ainda não convertidos
            q = q.where(Attendance.converted_to_procedure == False)
        if client_id:
            q = q.where(Attendance.client_id == client_id)

        total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
        offset = (page - 1) * page_size
        res = await db.execute(q.order_by(Attendance.created_at.desc()).offset(offset).limit(page_size))
        items = [self._to_read(a) for a in res.scalars().unique().all()]
        return PaginatedAttendances(
            items=items, total=total, page=page, page_size=page_size,
            pages=math.ceil(total / page_size) if total else 0,
        )


crud_attendance = CRUDAttendance(Attendance)
