import uuid

from pydantic import BaseModel, Field


class ProcedureTypeRead(BaseModel):
    id: uuid.UUID
    code: str
    label: str
    is_active: bool
    sort_order: int
    in_use: bool = False

    model_config = {"from_attributes": True}


class ProcedureTypeCreate(BaseModel):
    label: str = Field(min_length=2, max_length=200)


class ProcedureTypeUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=2, max_length=200)
    is_active: bool | None = None
    sort_order: int | None = None
