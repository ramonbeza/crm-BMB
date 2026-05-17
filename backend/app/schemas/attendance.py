import uuid
from datetime import datetime

from pydantic import BaseModel


class AttendanceBase(BaseModel):
    meeting_id: uuid.UUID | None = None
    client_id: uuid.UUID
    user_id: uuid.UUID | None = None
    decisions: str | None = None
    pending_items: str | None = None
    converted_to_procedure: bool = False


class AttendanceCreate(AttendanceBase):
    pass


class AttendanceFromMeeting(BaseModel):
    """Cria um atendimento importando dados de uma reunião existente."""
    meeting_id: uuid.UUID
    decisions: str | None = None
    pending_items: str | None = None


class AttendanceUpdate(BaseModel):
    meeting_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    decisions: str | None = None
    pending_items: str | None = None
    converted_to_procedure: bool | None = None


class AttendanceRead(AttendanceBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    client_name: str | None = None
    user_name: str | None = None
    meeting_subject: str | None = None

    model_config = {"from_attributes": True}


class PaginatedAttendances(BaseModel):
    items: list[AttendanceRead]
    total: int
    page: int
    page_size: int
    pages: int
