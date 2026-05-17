from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, get_session
from app.crud.client import crud_client
from app.models.client import ClientType
from app.models.user import UserRole
from app.schemas.client import (
    ClientPFCreate,
    ClientPFRead,
    ClientPFUpdate,
    ClientPJCreate,
    ClientPJRead,
    ClientPJUpdate,
    PaginatedClients,
)

router = APIRouter()


def _can_delete(user) -> bool:
    return user.role in (UserRole.admin, UserRole.advogado)


@router.get("/", response_model=PaginatedClients)
async def list_clients(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    client_type: ClientType | None = Query(None),
    active_only: bool = Query(True),
):
    return await crud_client.list_paginated(
        db,
        page=page,
        page_size=page_size,
        search=search,
        client_type=client_type,
        active_only=active_only,
    )


@router.post("/pf", response_model=ClientPFRead, status_code=status.HTTP_201_CREATED)
async def create_client_pf(
    body: ClientPFCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await crud_client.create_pf(db, obj_in=body, created_by_id=current_user.id)


@router.post("/pj", response_model=ClientPJRead, status_code=status.HTTP_201_CREATED)
async def create_client_pj(
    body: ClientPJCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await crud_client.create_pj(db, obj_in=body, created_by_id=current_user.id)


@router.get("/{client_id}", response_model=ClientPFRead | ClientPJRead)
async def get_client(
    client_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    client = await crud_client.get_with_data(db, client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    return client


@router.put("/{client_id}/pf", response_model=ClientPFRead)
async def update_client_pf(
    client_id: UUID,
    body: ClientPFUpdate,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    client = await crud_client.get_with_data(db, client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    if client.client_type != ClientType.PF:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cliente não é PF")
    return await crud_client.update_pf(db, db_obj=client, obj_in=body)


@router.put("/{client_id}/pj", response_model=ClientPJRead)
async def update_client_pj(
    client_id: UUID,
    body: ClientPJUpdate,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    client = await crud_client.get_with_data(db, client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    if client.client_type != ClientType.PJ:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cliente não é PJ")
    return await crud_client.update_pj(db, db_obj=client, obj_in=body)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    if not _can_delete(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas admin ou advogado podem desativar clientes",
        )
    client = await crud_client.soft_delete(db, id=client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
