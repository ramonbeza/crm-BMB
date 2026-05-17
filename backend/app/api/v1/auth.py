from fastapi import APIRouter, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated
from fastapi import Depends

from app.core.deps import CurrentUser, get_session
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_refresh_token,
    verify_password,
)
from app.crud.user import crud_user
from app.schemas.auth import AccessTokenResponse, LoginRequest, RefreshRequest, TokenResponse
from app.schemas.user import UserReadMe

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    user = await crud_user.get_by_email(db, body.email)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo",
        )

    access_token = create_access_token(
        subject=str(user.id),
        extra_claims={"role": user.role, "name": user.name},
    )
    raw_rt, hashed_rt = create_refresh_token()
    await crud_user.create_refresh_token(db, user_id=user.id, token_hash=hashed_rt)

    return TokenResponse(access_token=access_token, refresh_token=raw_rt)


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    token_hash = hash_refresh_token(body.refresh_token)
    rt = await crud_user.get_refresh_token(db, token_hash=token_hash)
    if not rt:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido ou expirado",
        )

    user = await crud_user.get(db, id=rt.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário inativo",
        )

    access_token = create_access_token(
        subject=str(user.id),
        extra_claims={"role": user.role, "name": user.name},
    )
    return AccessTokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    token_hash = hash_refresh_token(body.refresh_token)
    await crud_user.revoke_refresh_token(db, token_hash=token_hash)


@router.get("/me", response_model=UserReadMe)
async def me(current_user: CurrentUser):
    return current_user
