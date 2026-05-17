from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import AdminOnly, CurrentUser, get_session
from app.crud.user import crud_user
from app.models.user import UserRole
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter()


@router.get("/", response_model=list[UserRead])
async def list_users(
    _: AdminOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await crud_user.get_all_active(db)


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    _: AdminOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    existing = await crud_user.get_by_email(db, body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email já cadastrado",
        )
    return await crud_user.create_user(db, obj_in=body)


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    if current_user.role != UserRole.admin and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão insuficiente")
    user = await crud_user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    return user


@router.put("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    # Não-admin só pode editar a si mesmo, e não pode mudar role
    if current_user.role != UserRole.admin:
        if current_user.id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão insuficiente")
        body.role = None
        body.is_active = None

    user = await crud_user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    return await crud_user.update_user(db, db_obj=user, obj_in=body)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: UUID,
    _: AdminOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    user = await crud_user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    await crud_user.update_user(db, db_obj=user, obj_in=UserUpdate(is_active=False))
    await crud_user.revoke_all_user_tokens(db, user_id=user_id)
