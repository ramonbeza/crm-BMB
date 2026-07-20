import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.models.meeting import MeetingCategory, MeetingStatus, RecurrenceType, ReceptionType


class MeetingBase(BaseModel):
    client_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    meeting_category: MeetingCategory = MeetingCategory.reuniao_cliente
    scheduled_at: datetime
    duration_minutes: int = 60
    reception_type: ReceptionType = ReceptionType.presencial
    subject: str
    summary: str | None = None
    status: MeetingStatus = MeetingStatus.agendada
    recurrence_type: RecurrenceType = RecurrenceType.none
    recurrence_days: str | None = None
    recurrence_end_date: date | None = None


class MeetingCreate(MeetingBase):
    pass


class MeetingUpdate(BaseModel):
    client_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    meeting_category: MeetingCategory | None = None
    scheduled_at: datetime | None = None
    duration_minutes: int | None = None
    reception_type: ReceptionType | None = None
    subject: str | None = None
    summary: str | None = None
    status: MeetingStatus | None = None
    recurrence_type: RecurrenceType | None = None
    recurrence_days: str | None = None
    recurrence_end_date: date | None = None


class MeetingRead(MeetingBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    client_name: str | None = None
    user_name: str | None = None
    google_event_id: str | None = None
    meeting_category_label: str | None = None

    model_config = {"from_attributes": True}


class PaginatedMeetings(BaseModel):
    items: list[MeetingRead]
    total: int
    page: int
    page_size: int
    pages: int
