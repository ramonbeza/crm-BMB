from fastapi import APIRouter

from app.api.v1 import ai_documents, attendances, auth, clients, communications, d4sign, documents, financial, integrations, legal_docs, meetings, notifications, procedures, properties, quotes, reports, search, users

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
router.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
router.include_router(ai_documents.router, prefix="/ai", tags=["ai-documents"])
router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
router.include_router(search.router, prefix="/search", tags=["search"])
router.include_router(d4sign.router, prefix="/d4sign", tags=["d4sign"])
router.include_router(documents.router, prefix="/documents", tags=["documents"])
router.include_router(legal_docs.router, prefix="/legal-docs", tags=["legal-docs"])
