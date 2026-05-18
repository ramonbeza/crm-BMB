import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.models.procedure import ProcedureStatus, ProcedureType, StageStatus


# ── Stage ─────────────────────────────────────────────────────────────────────

class StageRead(BaseModel):
    id: uuid.UUID
    procedure_id: uuid.UUID
    order: int
    name: str
    status: StageStatus
    assigned_user_id: uuid.UUID | None
    assigned_user_name: str | None = None
    due_date: date | None
    completed_at: datetime | None
    notes: str | None

    model_config = {"from_attributes": True}


class StageUpdate(BaseModel):
    status: StageStatus | None = None
    assigned_user_id: uuid.UUID | None = None
    due_date: date | None = None
    notes: str | None = None


# ── Procedure ─────────────────────────────────────────────────────────────────

class ProcedureBase(BaseModel):
    client_id: uuid.UUID
    procedure_type: ProcedureType
    opened_at: date
    description: str | None = None
    property_description: str | None = None
    matricula: str | None = None
    incra: str | None = None
    inscricao_imobiliaria: str | None = None
    requerente: str | None = None
    deadline: date | None = None
    tags: list[str] = []
    responsible_user_id: uuid.UUID | None = None
    property_id: uuid.UUID | None = None


class ProcedureCreate(ProcedureBase):
    pass


class ProcedureFromAttendance(ProcedureBase):
    attendance_id: uuid.UUID


class ProcedureUpdate(BaseModel):
    procedure_type: ProcedureType | None = None
    opened_at: date | None = None
    description: str | None = None
    property_description: str | None = None
    matricula: str | None = None
    incra: str | None = None
    inscricao_imobiliaria: str | None = None
    requerente: str | None = None
    deadline: date | None = None
    tags: list[str] | None = None
    status: ProcedureStatus | None = None
    responsible_user_id: uuid.UUID | None = None
    property_id: uuid.UUID | None = None


class ChecklistItemRead(BaseModel):
    id: uuid.UUID
    procedure_id: uuid.UUID
    order: int
    name: str
    responsavel: str
    status: str
    notas: str | None
    received_at: datetime | None

    model_config = {"from_attributes": True}


class ProcedureRead(ProcedureBase):
    id: uuid.UUID
    protocol_number: int
    status: ProcedureStatus
    attendance_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    client_name: str | None = None
    responsible_name: str | None = None
    procedure_type_label: str | None = None
    stages: list[StageRead] = []
    checklist_items: list[ChecklistItemRead] = []

    model_config = {"from_attributes": True}


class ProcedureListItem(BaseModel):
    id: uuid.UUID
    protocol_number: int
    client_name: str | None
    procedure_type: str
    procedure_type_label: str
    status: ProcedureStatus
    opened_at: date
    deadline: date | None
    tags: list[str]
    responsible_name: str | None
    stages_done: int
    stages_total: int

    model_config = {"from_attributes": True}


class PaginatedProcedures(BaseModel):
    items: list[ProcedureListItem]
    total: int
    page: int
    page_size: int
    pages: int


class ProcedureTypeOption(BaseModel):
    value: str
    label: str
