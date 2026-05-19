from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import InternalOnly, get_session
from app.crud.attendance import crud_attendance
from app.crud.meeting import crud_meeting
from app.schemas.attendance import (
    AttendanceCreate,
    AttendanceFromMeeting,
    AttendanceRead,
    AttendanceUpdate,
    PaginatedAttendances,
)

router = APIRouter()


@router.get("/", response_model=PaginatedAttendances)
async def list_attendances(
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    client_id: UUID | None = Query(None),
):
    return await crud_attendance.list_paginated(db, page=page, page_size=page_size, client_id=client_id)


@router.get("/pending-procedures", response_model=PaginatedAttendances)
async def list_pending_procedures(
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """Atendimentos pendentes de virar procedimento (Sprint 3)."""
    return await crud_attendance.list_paginated(db, page=page, page_size=page_size, pending_only=True)


@router.post("/", response_model=AttendanceRead, status_code=status.HTTP_201_CREATED)
async def create_attendance(
    body: AttendanceCreate,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await crud_attendance.create_attendance(db, obj_in=body, created_by_id=current_user.id)


@router.post("/from-meeting", response_model=AttendanceRead, status_code=status.HTTP_201_CREATED)
async def create_attendance_from_meeting(
    body: AttendanceFromMeeting,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    meeting = await crud_meeting.get_full(db, body.meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reunião não encontrada")
    return await crud_attendance.create_from_meeting(
        db, obj_in=body, meeting=meeting, created_by_id=current_user.id
    )


@router.get("/{attendance_id}", response_model=AttendanceRead)
async def get_attendance(
    attendance_id: UUID,
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    a = await crud_attendance.get_full(db, attendance_id)
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Atendimento não encontrado")
    return crud_attendance._to_read(a)


@router.put("/{attendance_id}", response_model=AttendanceRead)
async def update_attendance(
    attendance_id: UUID,
    body: AttendanceUpdate,
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    a = await crud_attendance.get_full(db, attendance_id)
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Atendimento não encontrado")
    return await crud_attendance.update_attendance(db, db_obj=a, obj_in=body)


@router.delete("/{attendance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attendance(
    attendance_id: UUID,
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    a = await crud_attendance.get_full(db, attendance_id)
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Atendimento não encontrado")
    await db.delete(a)
    await db.flush()
