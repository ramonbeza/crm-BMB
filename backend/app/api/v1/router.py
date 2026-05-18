from fastapi import APIRouter

from app.api.v1 import attendances, auth, clients, meetings, procedures, properties, users

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(clients.router, prefix="/clients", tags=["clients"])
router.include_router(meetings.router, prefix="/meetings", tags=["meetings"])
router.include_router(attendances.router, prefix="/attendances", tags=["attendances"])
router.include_router(procedures.router, prefix="/procedures", tags=["procedures"])
router.include_router(properties.router, prefix="/properties", tags=["properties"])
