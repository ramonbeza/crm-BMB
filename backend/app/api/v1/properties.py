from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, get_session
from app.crud.property import (
    add_checklist_item,
    create_property,
    get_checklist,
    get_checklist_item,
    get_property,
    list_properties,
    update_checklist_item,
    update_property,
)
from app.models.property import PROPERTY_TYPE_LABELS, ChecklistItem, Property
from app.schemas.property import (
    ChecklistItemRead,
    ChecklistItemUpdate,
    PaginatedProperties,
    PropertyClientCreate,
    PropertyClientRead,
    PropertyCreate,
    PropertyListItem,
    PropertyRead,
    PropertyUpdate,
)
from app.schemas.procedure import ChecklistItemRead as ProcChecklistItemRead

router = APIRouter()


# ── Properties ────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedProperties)
async def list_props(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
):
    return await list_properties(db, page=page, page_size=page_size, search=search)


@router.post("", response_model=PropertyRead, status_code=status.HTTP_201_CREATED)
async def create_prop(
    body: PropertyCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await create_property(db, obj_in=body, created_by_id=current_user.id)


# ── Checklist items (by procedure) — ANTES de /{property_id} ─────────────────

@router.get("/checklist/{procedure_id}", response_model=list[ProcChecklistItemRead])
async def get_proc_checklist(
    procedure_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    items = await get_checklist(db, procedure_id)
    return [
        ProcChecklistItemRead(
            id=i.id,
            procedure_id=i.procedure_id,
            order=i.order,
            name=i.name,
            responsavel=i.responsavel,
            status=i.status,
            notas=i.notas,
            received_at=i.received_at,
        )
        for i in items
    ]


@router.put("/checklist/item/{item_id}", response_model=ProcChecklistItemRead)
async def update_checklist(
    item_id: UUID,
    body: ChecklistItemUpdate,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    item = await get_checklist_item(db, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado")
    updated = await update_checklist_item(db, item=item, obj_in=body)
    return ProcChecklistItemRead(
        id=updated.id,
        procedure_id=updated.procedure_id,
        order=updated.order,
        name=updated.name,
        responsavel=updated.responsavel,
        status=updated.status,
        notas=updated.notas,
        received_at=updated.received_at,
    )


@router.post("/checklist/{procedure_id}", response_model=ProcChecklistItemRead, status_code=status.HTTP_201_CREATED)
async def add_checklist(
    procedure_id: UUID,
    body: dict,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    name = body.get("name", "")
    responsavel = body.get("responsavel", "cliente")
    if not name:
        raise HTTPException(status_code=400, detail="name é obrigatório")
    item = await add_checklist_item(db, procedure_id, name, responsavel)
    return ProcChecklistItemRead(
        id=item.id,
        procedure_id=item.procedure_id,
        order=item.order,
        name=item.name,
        responsavel=item.responsavel,
        status=item.status,
        notas=item.notas,
        received_at=item.received_at,
    )


# ── Property CRUD dinâmico — DEPOIS dos paths fixos ──────────────────────────

@router.get("/{property_id}", response_model=PropertyRead)
async def get_prop(
    property_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    prop = await get_property(db, property_id)
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imóvel não encontrado")
    from app.crud.property import _to_read, _count_procedures
    count = await _count_procedures(db, property_id)
    return _to_read(prop, count)


@router.put("/{property_id}", response_model=PropertyRead)
async def update_prop(
    property_id: UUID,
    body: PropertyUpdate,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    prop = await get_property(db, property_id)
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imóvel não encontrado")
    return await update_property(db, db_obj=prop, obj_in=body)


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_prop(
    property_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    prop = await get_property(db, property_id)
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imóvel não encontrado")
    prop.is_active = False
    await db.commit()
