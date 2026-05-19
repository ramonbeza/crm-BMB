from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_session
from app.models.user import User, UserRole

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None or token_type != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    from app.crud.user import crud_user
    user = await crud_user.get(session, id=UUID(user_id))
    if user is None or not user.is_active:
        raise credentials_exception
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole):
    async def _check(current_user: CurrentUser):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permissão insuficiente",
            )
        return current_user
    return _check


# Apenas usuários internos (exclui despachante-externo)
def _require_internal(current_user: CurrentUser) -> User:  # type: ignore[misc]
    pass  # substituído pelo Depends abaixo


async def _internal_only(current_user: CurrentUser) -> User:
    if current_user.role == UserRole.despachante_externo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a usuários internos do escritório.",
        )
    return current_user


AdminOnly = Annotated[User, Depends(require_roles(UserRole.admin))]
InternalOnly = Annotated[User, Depends(_internal_only)]


def is_despachante(user: User) -> bool:
    """Retorna True se o usuário é despachante-externo."""
    return user.role == UserRole.despachante_externo
