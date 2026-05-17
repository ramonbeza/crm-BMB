import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.meeting import MeetingStatus, ReceptionType


class MeetingBase(BaseModel):
    client_id: uuid.UUID
    user_id: uuid.UUID | None = None
    scheduled_at: datetime
    reception_type: ReceptionType = ReceptionType.presencial
    subject: str
    summary: str | None = None
    status: MeetingStatus = MeetingStatus.agendada


class MeetingCreate(MeetingBase):
    pass


class MeetingUpdate(BaseModel):
    client_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    scheduled_at: datetime | None = None
    reception_type: ReceptionType | None = None
    subject: str | None = None
    summary: str | None = None
    status: MeetingStatus | None = None


class MeetingRead(MeetingBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    # Campos display para a UI
    client_name: str | None = None
    user_name: str | None = None

    model_config = {"from_attributes": True}


class PaginatedMeetings(BaseModel):
    items: list[MeetingRead]
    total: int
    page: int
    page_size: int
    pages: int
