from fastapi import APIRouter

from app.api.v1 import auth, clients, users

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(clients.router, prefix="/clients", tags=["clients"])
