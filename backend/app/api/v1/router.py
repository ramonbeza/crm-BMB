from fastapi import APIRouter

from app.api.v1 import attendances, auth, clients, communications, financial, meetings, procedures, properties, quotes, reports, users

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(clients.router, prefix="/clients", tags=["clients"])
router.include_router(meetings.router, prefix="/meetings", tags=["meetings"])
router.include_router(attendances.router, prefix="/attendances", tags=["attendances"])
router.include_router(procedures.router, prefix="/procedures", tags=["procedures"])
router.include_router(properties.router, prefix="/properties", tags=["properties"])
router.include_router(quotes.router, prefix="/quotes", tags=["quotes"])
router.include_router(financial.router, prefix="/financial", tags=["financial"])
router.include_router(communications.router, prefix="/communications", tags=["communications"])
router.include_router(reports.router, prefix="/reports", tags=["reports"])
