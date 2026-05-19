"""
Sprint 17 — D4Sign: assinatura digital de orçamentos e contratos.

Rotas:
  POST /d4sign/quotes/{quote_id}/send       — envia orçamento para assinar
  POST /d4sign/contracts/{contract_id}/send — envia contrato para assinar
  GET  /d4sign/quotes/{quote_id}/status     — consulta status do orçamento
  GET  /d4sign/contracts/{contract_id}/status — consulta status do contrato
  POST /d4sign/webhook                      — recebe notificação do D4Sign
  POST /d4sign/quotes/{quote_id}/cancel     — cancela envio
  POST /d4sign/contracts/{contract_id}/cancel — cancela envio

Autenticação: somente InternalOnly (despachante não acessa contratos/orçamentos).
"""
from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

import sqlalchemy as sa
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import d4sign as d4
from app.core.config import settings
from app.core.deps import InternalOnly, get_session
from app.models.quote import Contract, Quote

router = APIRouter()

_MAX_PDF_SIZE = 20 * 1024 * 1024  # 20 MB


# ── Schemas ────────────────────────────────────────────────────────────────────

class SendRequest(BaseModel):
    signer_email: str
    signer_name: str
    message: str = "Por favor, assine o documento."
    auth_method: str = "email"   # email | sms | whatsapp


class D4SignStatusResponse(BaseModel):
    document_uuid: str | None
    d4sign_status: str | None
    sign_url: str | None
    signed_at: datetime | None


class WebhookPayload(BaseModel):
    model_config = {"extra": "allow"}
    uuid: str | None = None
    type_post: str | None = None      # "signed" | "cancelled" | "reading" | "unenveloped"
    message: str | None = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _require_d4sign() -> None:
    if not settings.d4sign_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="D4Sign não configurado. Adicione D4SIGN_TOKEN_API e D4SIGN_SAFE_UUID ao .env.",
        )


async def _get_quote(db: AsyncSession, quote_id: uuid.UUID) -> Quote:
    q = (await db.execute(sa.select(Quote).where(Quote.id == quote_id))).scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return q


async def _get_contract(db: AsyncSession, contract_id: uuid.UUID) -> Contract:
    c = (await db.execute(sa.select(Contract).where(Contract.id == contract_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    return c


async def _do_send(
    db: AsyncSession,
    entity: Quote | Contract,
    pdf_bytes: bytes,
    filename: str,
    req: SendRequest,
) -> dict[str, Any]:
    """Lógica comum de upload + criação de lista + envio para assinatura."""
    if entity.d4sign_document_uuid and entity.d4sign_status in ("em_assinatura", "aguardando_signatarios"):
        raise HTTPException(
            status_code=400,
            detail=f"Documento já enviado para assinatura (status: {entity.d4sign_status}). Cancele primeiro.",
        )

    try:
        doc_uuid = await d4.upload_document(pdf_bytes, filename)
        await d4.add_signer(
            doc_uuid,
            signer_email=req.signer_email,
            signer_name=req.signer_name,
            auth_method=req.auth_method,
        )
        result = await d4.send_to_sign(doc_uuid, message=req.message)
    except (ValueError, Exception) as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    # Persiste no banco
    entity.d4sign_document_uuid = doc_uuid
    entity.d4sign_status = "aguardando_signatarios"
    # D4Sign retorna o link de assinatura embarcado no resultado de sendtosigner
    entity.d4sign_sign_url = result.get("signers", [{}])[0].get("link_sign", "") or ""
    await db.commit()
    await db.refresh(entity)

    return {
        "document_uuid": doc_uuid,
        "d4sign_status": entity.d4sign_status,
        "sign_url": entity.d4sign_sign_url,
        "d4sign_raw": result,
    }


# ── Quote endpoints ────────────────────────────────────────────────────────────

@router.post("/quotes/{quote_id}/send", summary="Enviar orçamento para assinatura D4Sign")
async def send_quote(
    quote_id: uuid.UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
    pdf_file: UploadFile = File(..., description="PDF do orçamento"),
    signer_email: str = Form(...),
    signer_name: str = Form(...),
    message: str = Form("Por favor, assine o orçamento."),
    auth_method: str = Form("email"),
) -> dict[str, Any]:
    _require_d4sign()
    quote = await _get_quote(db, quote_id)
    pdf_bytes = await pdf_file.read()
    if len(pdf_bytes) > _MAX_PDF_SIZE:
        raise HTTPException(status_code=413, detail="PDF muito grande (máx. 20 MB)")
    filename = pdf_file.filename or f"orcamento-{quote_id}.pdf"
    req = SendRequest(signer_email=signer_email, signer_name=signer_name,
                      message=message, auth_method=auth_method)
    return await _do_send(db, quote, pdf_bytes, filename, req)


@router.get("/quotes/{quote_id}/status", response_model=D4SignStatusResponse,
            summary="Status D4Sign do orçamento")
async def quote_status(
    quote_id: uuid.UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> D4SignStatusResponse:
    _require_d4sign()
    quote = await _get_quote(db, quote_id)
    if not quote.d4sign_document_uuid:
        return D4SignStatusResponse(
            document_uuid=None, d4sign_status=None,
            sign_url=None, signed_at=quote.signed_at
        )
    try:
        data = await d4.get_document_status(quote.d4sign_document_uuid)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    raw_status = str(data.get("statusId", ""))
    new_status = d4.D4SIGN_STATUS.get(raw_status, quote.d4sign_status)
    if new_status != quote.d4sign_status:
        quote.d4sign_status = new_status
        await db.commit()

    return D4SignStatusResponse(
        document_uuid=quote.d4sign_document_uuid,
        d4sign_status=quote.d4sign_status,
        sign_url=quote.d4sign_sign_url,
        signed_at=quote.signed_at,
    )


@router.post("/quotes/{quote_id}/cancel", summary="Cancelar envio D4Sign do orçamento",
             status_code=status.HTTP_204_NO_CONTENT)
async def cancel_quote(
    quote_id: uuid.UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    _require_d4sign()
    quote = await _get_quote(db, quote_id)
    if not quote.d4sign_document_uuid:
        raise HTTPException(status_code=400, detail="Orçamento não foi enviado ao D4Sign")
    try:
        await d4.cancel_document(quote.d4sign_document_uuid, "Cancelado pelo usuário")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    quote.d4sign_status = "cancelado"
    await db.commit()
    return Response(status_code=204)


# ── Contract endpoints ─────────────────────────────────────────────────────────

@router.post("/contracts/{contract_id}/send", summary="Enviar contrato para assinatura D4Sign")
async def send_contract(
    contract_id: uuid.UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
    pdf_file: UploadFile = File(..., description="PDF do contrato"),
    signer_email: str = Form(...),
    signer_name: str = Form(...),
    message: str = Form("Por favor, assine o contrato de honorários."),
    auth_method: str = Form("email"),
) -> dict[str, Any]:
    _require_d4sign()
    contract = await _get_contract(db, contract_id)
    pdf_bytes = await pdf_file.read()
    if len(pdf_bytes) > _MAX_PDF_SIZE:
        raise HTTPException(status_code=413, detail="PDF muito grande (máx. 20 MB)")
    filename = pdf_file.filename or f"contrato-{contract_id}.pdf"
    req = SendRequest(signer_email=signer_email, signer_name=signer_name,
                      message=message, auth_method=auth_method)
    return await _do_send(db, contract, pdf_bytes, filename, req)


@router.get("/contracts/{contract_id}/status", response_model=D4SignStatusResponse,
            summary="Status D4Sign do contrato")
async def contract_status(
    contract_id: uuid.UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> D4SignStatusResponse:
    _require_d4sign()
    contract = await _get_contract(db, contract_id)
    if not contract.d4sign_document_uuid:
        return D4SignStatusResponse(
            document_uuid=None, d4sign_status=None,
            sign_url=None, signed_at=contract.signed_at
        )
    try:
        data = await d4.get_document_status(contract.d4sign_document_uuid)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    raw_status = str(data.get("statusId", ""))
    new_status = d4.D4SIGN_STATUS.get(raw_status, contract.d4sign_status)
    if new_status != contract.d4sign_status:
        contract.d4sign_status = new_status
        await db.commit()

    return D4SignStatusResponse(
        document_uuid=contract.d4sign_document_uuid,
        d4sign_status=contract.d4sign_status,
        sign_url=contract.d4sign_sign_url,
        signed_at=contract.signed_at,
    )


@router.post("/contracts/{contract_id}/cancel", summary="Cancelar envio D4Sign do contrato",
             status_code=status.HTTP_204_NO_CONTENT)
async def cancel_contract(
    contract_id: uuid.UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    _require_d4sign()
    contract = await _get_contract(db, contract_id)
    if not contract.d4sign_document_uuid:
        raise HTTPException(status_code=400, detail="Contrato não foi enviado ao D4Sign")
    try:
        await d4.cancel_document(contract.d4sign_document_uuid, "Cancelado pelo usuário")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    contract.d4sign_status = "cancelado"
    await db.commit()
    return Response(status_code=204)


# ── Webhook ────────────────────────────────────────────────────────────────────

@router.post("/webhook", summary="Webhook D4Sign — notificação de evento de assinatura",
             status_code=status.HTTP_200_OK)
async def d4sign_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    """
    Recebe notificações do D4Sign.
    type_post: "signed" | "cancelled" | "reading" | "unenveloped"

    Validação HMAC opcional: se D4SIGN_WEBHOOK_SECRET estiver configurado,
    valida o header X-D4Sign-Signature.
    """
    body = await request.body()

    # Validação HMAC (opcional mas recomendada em produção)
    if settings.D4SIGN_WEBHOOK_SECRET:
        sig_header = request.headers.get("X-D4Sign-Signature", "")
        mac = hmac.HMAC(
            key=settings.D4SIGN_WEBHOOK_SECRET.encode(),
            msg=body,
            digestmod=hashlib.sha256,
        )
        expected = mac.hexdigest()
        if not hmac.compare_digest(sig_header, expected):
            raise HTTPException(status_code=401, detail="Assinatura do webhook inválida")

    try:
        payload = WebhookPayload.model_validate_json(body)
    except Exception:
        raise HTTPException(status_code=422, detail="Payload inválido")

    doc_uuid = payload.uuid
    event = payload.type_post

    if not doc_uuid:
        return {"status": "ignored"}

    now = datetime.now(timezone.utc)

    # Busca o documento em quotes e contracts
    quote = (
        await db.execute(sa.select(Quote).where(Quote.d4sign_document_uuid == doc_uuid))
    ).scalar_one_or_none()

    contract = None
    if not quote:
        contract = (
            await db.execute(sa.select(Contract).where(Contract.d4sign_document_uuid == doc_uuid))
        ).scalar_one_or_none()

    entity = quote or contract
    if entity is None:
        return {"status": "not_found"}

    if event == "signed":
        entity.d4sign_status = "concluido"
        entity.status = "assinado"
        entity.signed_at = now
    elif event == "cancelled":
        entity.d4sign_status = "cancelado"
    elif event == "reading":
        entity.d4sign_status = "em_assinatura"

    await db.commit()
    return {"status": "ok"}
