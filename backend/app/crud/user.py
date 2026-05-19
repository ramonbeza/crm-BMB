from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password, hash_refresh_token
from app.crud.base import CRUDBase
from app.models.user import RefreshToken, User, UserRole
from app.schemas.user import UserCreate, UserUpdate


class CRUDUser(CRUDBase[User]):
    async def get_by_email(self, db: AsyncSession, email: str) -> User | None:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def create_user(self, db: AsyncSession, *, obj_in: UserCreate) -> User:
        user = User(
            name=obj_in.name,
            email=obj_in.email,
            password_hash=hash_password(obj_in.password),
            role=obj_in.role,
            cnpj_empresa=obj_in.cnpj_empresa,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
        return user

    async def update_user(self, db: AsyncSession, *, db_obj: User, obj_in: UserUpdate) -> User:
        if obj_in.name is not None:
            db_obj.name = obj_in.name
        if obj_in.email is not None:
            db_obj.email = obj_in.email
        if obj_in.role is not None:
            db_obj.role = obj_in.role
        if obj_in.is_active is not None:
            db_obj.is_active = obj_in.is_active
        if obj_in.password is not None:
            db_obj.password_hash = hash_password(obj_in.password)
        if obj_in.cnpj_empresa is not None:
            db_obj.cnpj_empresa = obj_in.cnpj_empresa
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def get_all_active(self, db: AsyncSession) -> list[User]:
        result = await db.execute(select(User).where(User.is_active == True).order_by(User.name))
        return list(result.scalars().all())

    async def get_all(self, db: AsyncSession, *, include_inactive: bool = False) -> list[User]:
        q = select(User)
        if not include_inactive:
            q = q.where(User.is_active == True)
        result = await db.execute(q.order_by(User.is_active.desc(), User.name))
        return list(result.scalars().all())

    # ── Refresh tokens ──────────────────────────────────────────────────────

    async def create_refresh_token(
        self, db: AsyncSession, *, user_id: UUID, token_hash: str
    ) -> RefreshToken:
        rt = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            created_at=datetime.now(timezone.utc),
        )
        db.add(rt)
        await db.flush()
        return rt

    async def get_refresh_token(self, db: AsyncSession, *, token_hash: str) -> RefreshToken | None:
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked == False,
                RefreshToken.expires_at > datetime.now(timezone.utc),
            )
        )
        return result.scalar_one_or_none()

    async def revoke_refresh_token(self, db: AsyncSession, *, token_hash: str) -> None:
        rt = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        obj = rt.scalar_one_or_none()
        if obj:
            obj.revoked = True
            db.add(obj)
            await db.flush()

    async def revoke_all_user_tokens(self, db: AsyncSession, *, user_id: UUID) -> None:
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id, RefreshToken.revoked == False
            )
        )
        for token in result.scalars().all():
            token.revoked = True
            db.add(token)
        await db.flush()


crud_user = CRUDUser(User)
