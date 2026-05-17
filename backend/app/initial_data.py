"""Cria o primeiro usuário admin se não existir. Executado no startup."""
import asyncio

from app.core.config import settings
from app.crud.user import crud_user
from app.db.session import AsyncSessionLocal
from app.models.user import UserRole
from app.schemas.user import UserCreate


async def create_first_admin() -> None:
    async with AsyncSessionLocal() as session:
        existing = await crud_user.get_by_email(session, settings.FIRST_ADMIN_EMAIL)
        if existing:
            return
        user_in = UserCreate(
            name=settings.FIRST_ADMIN_NAME,
            email=settings.FIRST_ADMIN_EMAIL,
            password=settings.FIRST_ADMIN_PASSWORD,
            role=UserRole.admin,
        )
        user = await crud_user.create_user(session, obj_in=user_in)
        await session.commit()
        print(f"[startup] Admin criado: {user.email}")


if __name__ == "__main__":
    asyncio.run(create_first_admin())
