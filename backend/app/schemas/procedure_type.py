import uuid

from pydantic import BaseModel, Field, field_validator


class ProcedureTypeRead(BaseModel):
    id: uuid.UUID
    code: str
    label: str
    is_active: bool
    sort_order: int
    stage_template: list[str]
    in_use: bool = False

    model_config = {"from_attributes": True}


class ProcedureTypeCreate(BaseModel):
    label: str = Field(min_length=2, max_length=200)


class ProcedureTypeUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=2, max_length=200)
    is_active: bool | None = None
    sort_order: int | None = None
    stage_template: list[str] | None = Field(default=None, min_length=1, max_length=30)

    @field_validator("stage_template")
    @classmethod
    def _clean_stages(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        cleaned = [s.strip() for s in v if s.strip()]
        if not cleaned:
            raise ValueError("A lista de etapas não pode ficar vazia.")
        return cleaned
