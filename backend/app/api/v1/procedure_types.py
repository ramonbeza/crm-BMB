from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import AdminOrAdvogado, InternalOnly, get_session
from app.crud.procedure_type import crud_procedure_type
from app.schemas.procedure_type import ProcedureTypeCreate, ProcedureTypeRead, ProcedureTypeUpdate

router = APIRouter()


@router.get("", response_model=list[ProcedureTypeRead])
async def list_procedure_types(
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
    active_only: bool = Query(False),
):
    rows = await crud_procedure_type.list_all(db, active_only=active_only)
    in_use = await crud_procedure_type.get_in_use_codes(db)
    return [
        ProcedureTypeRead.model_validate(r, from_attributes=True).model_copy(
            update={"in_use": r.code in in_use}
        )
        for r in rows
    ]


@router.post("", response_model=ProcedureTypeRead, status_code=status.HTTP_201_CREATED)
async def create_procedure_type(
    body: ProcedureTypeCreate,
    _: AdminOrAdvogado,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    obj = await crud_procedure_type.create(db, obj_in=body)
    return ProcedureTypeRead.model_validate(obj, from_attributes=True)


@router.put("/{type_id}", response_model=ProcedureTypeRead)
async def update_procedure_type(
    type_id: UUID,
    body: ProcedureTypeUpdate,
    _: AdminOrAdvogado,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    obj = await crud_procedure_type.get(db, type_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo de procedimento não encontrado")
    obj = await crud_procedure_type.update(db, db_obj=obj, obj_in=body)
    return ProcedureTypeRead.model_validate(obj, from_attributes=True)


@router.delete("/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_procedure_type(
    type_id: UUID,
    _: AdminOrAdvogado,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    obj = await crud_procedure_type.get(db, type_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo de procedimento não encontrado")
    if await crud_procedure_type.is_in_use(db, obj.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este tipo está em uso por procedimentos existentes. Desative-o em vez de excluir.",
        )
    await crud_procedure_type.delete(db, db_obj=obj)
