from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit
from app.core.deps import CurrentUser, InternalOnly, get_session, is_despachante
from app.crud.attendance import crud_attendance
from app.crud.procedure import crud_procedure
from app.models.procedure import PROCEDURE_TYPE_LABELS
from app.models.user import UserRole
from app.schemas.procedure import (
    PaginatedProcedures,
    ProcedureCreate,
    ProcedureFromAttendance,
    ProcedureRead,
    ProcedureTypeOption,
    ProcedureUpdate,
    StageRead,
    StageUpdate,
)

router = APIRouter()


@router.get("/types", response_model=list[ProcedureTypeOption])
async def list_procedure_types(_: CurrentUser):
    return [ProcedureTypeOption(value=k, label=v) for k, v in PROCEDURE_TYPE_LABELS.items()]


@router.get("", response_model=PaginatedProcedures)
async def list_procedures(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    procedure_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    client_id: UUID | None = Query(None),
    responsible_user_id: UUID | None = Query(None),
    tag: str | None = Query(None),
    property_id: UUID | None = Query(None),
):
    # Despachante-externo só vê procedimentos onde é executor
    executor_id: UUID | None = None
    if is_despachante(current_user):
        executor_id = current_user.id

    return await crud_procedure.list_paginated(
        db, page=page, page_size=page_size,
        procedure_type=procedure_type, status=status_filter,
        client_id=client_id, responsible_user_id=responsible_user_id,
        tag=tag, executor_user_id=executor_id, property_id=property_id,
    )


@router.post("", response_model=ProcedureRead, status_code=status.HTTP_201_CREATED)
async def create_procedure(
    request: Request,
    body: ProcedureCreate,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    result = await crud_procedure.create_procedure(db, obj_in=body, created_by_id=current_user.id)
    await audit(db, request, current_user, "procedure.created",
                entity_type="procedure", entity_id=str(result.id),
                details={"procedure_type": body.procedure_type, "client_id": str(body.client_id)})
    return result


@router.post("/from-attendance", response_model=ProcedureRead, status_code=status.HTTP_201_CREATED)
async def create_procedure_from_attendance(
    body: ProcedureFromAttendance,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    attendance = await crud_attendance.get_full(db, body.attendance_id)
    if not attendance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Atendimento não encontrado")
    return await crud_procedure.create_from_attendance(
        db, obj_in=body, attendance=attendance, created_by_id=current_user.id
    )


@router.get("/{procedure_id}", response_model=ProcedureRead)
async def get_procedure(
    procedure_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    p = await crud_procedure.get_full(db, procedure_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Procedimento não encontrado")
    # Despachante só pode ver seu próprio procedimento
    if is_despachante(current_user) and p.executor_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado a este procedimento.")
    return crud_procedure._to_read(p)


@router.put("/{procedure_id}", response_model=ProcedureRead)
async def update_procedure(
    request: Request,
    procedure_id: UUID,
    body: ProcedureUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    p = await crud_procedure.get_full(db, procedure_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Procedimento não encontrado")
    # Despachante só pode atualizar etapas — não dados gerais do procedimento
    if is_despachante(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Despachante-externo não pode editar dados do procedimento. Use a rota de etapas.",
        )
    # Valida que executor_user_id pertence a um despachante-externo
    if body.executor_user_id is not None:
        import sqlalchemy as sa
        from app.models.user import User
        res = await db.execute(sa.select(User).where(User.id == body.executor_user_id))
        executor = res.scalar_one_or_none()
        if not executor:
            raise HTTPException(status_code=404, detail="Usuário executor não encontrado.")
        if executor.role != UserRole.despachante_externo:
            raise HTTPException(
                status_code=422,
                detail=f"Usuário '{executor.name}' não é despachante-externo (role atual: {executor.role}).",
            )
    old_status = p.status
    result = await crud_procedure.update_procedure(db, db_obj=p, obj_in=body)
    # Audita apenas quando há mudança de status
    if body.status and body.status != old_status:
        await audit(db, request, current_user, "procedure.status_changed",
                    entity_type="procedure", entity_id=str(procedure_id),
                    details={"old_status": old_status, "new_status": body.status})
    return result


@router.put("/{procedure_id}/stages/{stage_id}", response_model=StageRead)
async def update_stage(
    procedure_id: UUID,
    stage_id: UUID,
    body: StageUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    stage = await crud_procedure.get_stage(db, stage_id)
    if not stage or stage.procedure_id != procedure_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Etapa não encontrada")

    # Despachante pode atualizar etapas do seu procedimento
    if is_despachante(current_user):
        p = await crud_procedure.get_full(db, procedure_id)
        if not p or p.executor_user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado.")

    return await crud_procedure.update_stage(db, stage=stage, obj_in=body)


@router.delete("/{procedure_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_procedure(
    request: Request,
    procedure_id: UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    if current_user.role not in (UserRole.admin, UserRole.advogado):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas admin ou advogado podem excluir procedimentos",
        )
    p = await crud_procedure.get_full(db, procedure_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Procedimento não encontrado")
    await audit(db, request, current_user, "procedure.deleted",
                entity_type="procedure", entity_id=str(procedure_id),
                details={"protocol_number": p.protocol_number})
    await db.delete(p)
    await db.flush()
