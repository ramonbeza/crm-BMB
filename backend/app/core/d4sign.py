"""
Cliente HTTP para a API D4Sign (assinatura digital ICP-Brasil).
Documentação: https://docapi.d4sign.com.br

Fluxo:
  1. upload_document()     → faz upload do PDF no cofre → retorna document_uuid
  2. add_signer()          → adiciona signatário ao documento
  3. send_to_sign()        → envia para assinatura; D4Sign notifica os signatários
  4. get_document_status() → consulta o status atual do documento
  5. Webhook recebido pelo endpoint POST /d4sign/webhook quando tudo assinar

Autenticação: headers tokenAPI + cryptKey em todas as requisições.
"""
from __future__ import annotations

import base64
from typing import Any

import httpx

from app.core.config import settings

D4SIGN_BASE = "https://secure.d4sign.com.br/api/v1"


def _headers() -> dict[str, str]:
    return {
        "tokenAPI": settings.D4SIGN_TOKEN_API,
        "cryptKey": settings.D4SIGN_CRYPT_KEY,
    }


def _check_cfg() -> None:
    if not settings.d4sign_configured:
        raise RuntimeError("D4Sign não configurado (D4SIGN_TOKEN_API / D4SIGN_SAFE_UUID ausentes)")


# ── Upload ─────────────────────────────────────────────────────────────────────

async def upload_document(
    pdf_bytes: bytes,
    filename: str,
) -> str:
    """
    Faz upload de um PDF no cofre D4Sign.
    Retorna o ``document_uuid`` do documento criado.
    """
    _check_cfg()
    b64 = base64.b64encode(pdf_bytes).decode()
    payload = {
        "base64_binary_file": b64,
        "mime_type": "application/pdf",
        "name": filename,
        "id_safe": settings.D4SIGN_SAFE_UUID,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{D4SIGN_BASE}/documents/{settings.D4SIGN_SAFE_UUID}/uploadbinaryfile",
            headers=_headers(),
            json=payload,
        )
    _raise_for(resp, "upload de documento")
    data = resp.json()
    # D4Sign retorna {"uuid": "..."}
    return data["uuid"]


# ── Adicionar signatário ───────────────────────────────────────────────────────

async def add_signer(
    document_uuid: str,
    signer_email: str,
    signer_name: str,
    action: str = "sign",        # sign | approve | recognize | signThenApprove
    signer_phone_country: str = "55",
    signer_phone_number: str = "",
    auth_method: str = "email",  # email | sms | whatsapp | icp-brasil
) -> None:
    """
    Adiciona um signatário ao documento. Pode ser chamada múltiplas vezes
    para múltiplos signatários.
    """
    _check_cfg()
    payload: dict[str, Any] = {
        "email": signer_email,
        "act": action,
        "foreign": "0",
        "certificadoicpbr": "0",
        "assinatura_presencial": "0",
        "embed_methodauth": auth_method,
        "embed_smsnumber": (
            f"{signer_phone_country}{signer_phone_number}" if signer_phone_number else ""
        ),
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{D4SIGN_BASE}/documents/{document_uuid}/createlist",
            headers=_headers(),
            json=payload,
        )
    _raise_for(resp, "adicionar signatário")


# ── Enviar para assinatura ─────────────────────────────────────────────────────

async def send_to_sign(
    document_uuid: str,
    message: str = "Por favor, assine o documento.",
    skip_email: str = "0",
    workflow: str = "0",           # 0 = todos ao mesmo tempo, 1 = sequencial
    workflow_finish_date: str = "",
) -> dict[str, Any]:
    """
    Envia o documento para os signatários.
    Retorna o payload de resposta do D4Sign (inclui link de assinatura embarcado).
    """
    _check_cfg()
    payload: dict[str, Any] = {
        "message": message,
        "skip_email": skip_email,
        "workflow": workflow,
    }
    if workflow_finish_date:
        payload["workflow_finish_date"] = workflow_finish_date

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{D4SIGN_BASE}/documents/{document_uuid}/sendtosigner",
            headers=_headers(),
            json=payload,
        )
    _raise_for(resp, "envio para assinatura")
    return resp.json()


# ── Status do documento ────────────────────────────────────────────────────────

async def get_document_status(document_uuid: str) -> dict[str, Any]:
    """
    Consulta o status atual do documento no D4Sign.
    Retorna o JSON completo do documento.

    Possíveis status_id:
      1 = Processando       2 = Aguardando signatários
      3 = Em assinatura     4 = Cancelado
      5 = Concluído
    """
    _check_cfg()
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{D4SIGN_BASE}/documents/{document_uuid}",
            headers=_headers(),
        )
    _raise_for(resp, "consulta de status")
    return resp.json()


# ── Cancelar documento ─────────────────────────────────────────────────────────

async def cancel_document(document_uuid: str, comment: str = "") -> None:
    """Cancela o documento no D4Sign."""
    _check_cfg()
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{D4SIGN_BASE}/documents/{document_uuid}/cancel",
            headers=_headers(),
            json={"comment": comment},
        )
    _raise_for(resp, "cancelamento de documento")


# ── Helpers ────────────────────────────────────────────────────────────────────

# Mapa de status_id → label legível
D4SIGN_STATUS: dict[str, str] = {
    "1": "processando",
    "2": "aguardando_signatarios",
    "3": "em_assinatura",
    "4": "cancelado",
    "5": "concluido",
}


def _raise_for(resp: httpx.Response, context: str) -> None:
    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text[:200]
        raise ValueError(f"D4Sign — erro em {context} (HTTP {resp.status_code}): {detail}")
