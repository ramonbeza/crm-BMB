from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, get_session
from app.crud.meeting import crud_meeting
from app.schemas.meeting import MeetingCreate, MeetingRead, MeetingUpdate, PaginatedMeetings

router = APIRouter()


@router.get("/", response_model=PaginatedMeetings)
async def list_meetings(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    user_id: UUID | None = Query(None),
    client_id: UUID | None = Query(None),
):
    return await crud_meeting.list_paginated(
        db, page=page, page_size=page_size,
        date_from=date_from, date_to=date_to, user_id=user_id, client_id=client_id,
    )


@router.post("/", response_model=MeetingRead, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    body: MeetingCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await crud_meeting.create_meeting(db, obj_in=body, created_by_id=current_user.id)


@router.get("/{meeting_id}", response_model=MeetingRead)
async def get_meeting(
    meeting_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    m = await crud_meeting.get_full(db, meeting_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reunião não encontrada")
    return crud_meeting._to_read(m)


@router.put("/{meeting_id}", response_model=MeetingRead)
async def update_meeting(
    meeting_id: UUID,
    body: MeetingUpdate,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    m = await crud_meeting.get_full(db, meeting_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reunião não encontrada")
    return await crud_meeting.update_meeting(db, db_obj=m, obj_in=body)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    m = await crud_meeting.get_full(db, meeting_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reunião não encontrada")
    await db.delete(m)
    await db.flush()
