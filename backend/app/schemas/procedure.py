import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.models.procedure import ProcedureStatus, StageStatus


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
    procedure_type: str
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
    procedure_type: str | None = None
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
    workspace_stage: str | None = None
    responsible_user_id: uuid.UUID | None = None
    executor_user_id: uuid.UUID | None = None
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
    executor_user_id: uuid.UUID | None = None
    attendance_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    client_name: str | None = None
    responsible_name: str | None = None
    executor_name: str | None = None
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


# ── Transfer ──────────────────────────────────────────────────────────────────

class TransferCreate(BaseModel):
    to_user_id: uuid.UUID
    notes: str | None = None


class TransferRead(BaseModel):
    id: uuid.UUID
    procedure_id: uuid.UUID
    from_user_id: uuid.UUID | None
    from_user_name: str | None = None
    to_user_id: uuid.UUID
    to_user_name: str | None = None
    transferred_by_id: uuid.UUID | None
    transferred_by_name: str | None = None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Comment ───────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    content: str


class CommentRead(BaseModel):
    id: uuid.UUID
    procedure_id: uuid.UUID
    author_id: uuid.UUID | None
    author_name: str | None = None
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Task ──────────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    assigned_to_id: uuid.UUID | None = None
    due_date: date | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    assigned_to_id: uuid.UUID | None = None
    due_date: date | None = None
    status: str | None = None


class TaskRead(BaseModel):
    id: uuid.UUID
    procedure_id: uuid.UUID
    title: str
    description: str | None
    assigned_to_id: uuid.UUID | None
    assigned_to_name: str | None = None
    created_by_id: uuid.UUID | None
    created_by_name: str | None = None
    due_date: date | None
    status: str
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Attachment ────────────────────────────────────────────────────────────────

class AttachmentRead(BaseModel):
    id: uuid.UUID
    procedure_id: uuid.UUID
    uploaded_by_id: uuid.UUID | None
    uploaded_by_name: str | None = None
    filename: str
    content_type: str | None
    file_size: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Workspace ─────────────────────────────────────────────────────────────────

class WorkspaceItem(BaseModel):
    id: uuid.UUID
    protocol_number: int
    client_name: str | None
    procedure_type: str
    procedure_type_label: str
    status: ProcedureStatus
    workspace_stage: str
    opened_at: date
    deadline: date | None
    tags: list[str]
    stages_done: int
    stages_total: int
    pending_tasks: int
    responsible_user_id: uuid.UUID | None
    responsible_name: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}
