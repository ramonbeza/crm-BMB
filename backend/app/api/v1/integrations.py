"""
Sprint 9 — Integrações externas:
  - Google Calendar OAuth2 (connect / callback / disconnect / sync)
  - ViaCEP (busca endereço por CEP)
  - BrasilAPI (busca dados de empresa por CNPJ)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

import httpx
import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import InternalOnly
from app.db.session import get_session
from app.models.integration import GoogleCalendarToken

router = APIRouter()

# ── helpers ───────────────────────────────────────────────────────────────────

GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]


def _build_flow() -> Flow:
    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    flow = Flow.from_client_config(client_config, scopes=GOOGLE_SCOPES)
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    return flow


def _creds_from_token(token_row: GoogleCalendarToken) -> Credentials:
    return Credentials(
        token=token_row.access_token,
        refresh_token=token_row.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=GOOGLE_SCOPES,
    )


# ── Google Calendar — OAuth2 ──────────────────────────────────────────────────

@router.get("/google/auth-url", summary="Gera URL de autorização Google")
async def google_auth_url(current_user: InternalOnly) -> dict[str, str]:
    """Retorna a URL para o usuário autorizar acesso ao Google Calendar."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google Calendar não configurado.")
    flow = _build_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        state=str(current_user.id),
        prompt="consent",
    )
    return {"auth_url": auth_url}


@router.get("/google/callback", summary="Callback OAuth2 Google")
async def google_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_session),
) -> RedirectResponse:
    """Recebe o código OAuth2 e armazena os tokens."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google Calendar não configurado.")

    flow = _build_flow()
    try:
        flow.fetch_token(code=code)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Erro ao trocar código: {exc}")

    creds = flow.credentials
    user_id = uuid.UUID(state)

    # Upsert token row
    existing = (
        await db.execute(
            sa.select(GoogleCalendarToken).where(GoogleCalendarToken.user_id == user_id)
        )
    ).scalar_one_or_none()

    expiry = creds.expiry
    if expiry and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    if existing:
        existing.access_token = creds.token or ""
        existing.refresh_token = creds.refresh_token or existing.refresh_token
        existing.token_expiry = expiry
        existing.scope = " ".join(creds.scopes or [])
    else:
        db.add(
            GoogleCalendarToken(
                user_id=user_id,
                access_token=creds.token or "",
                refresh_token=creds.refresh_token,
                token_expiry=expiry,
                scope=" ".join(creds.scopes or []),
            )
        )
    await db.commit()

    # Redireciona de volta para o frontend
    return RedirectResponse(url="/agenda?google=connected")


@router.get("/google/status", summary="Status da conexão Google Calendar")
async def google_status(
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    token = (
        await db.execute(
            sa.select(GoogleCalendarToken).where(
                GoogleCalendarToken.user_id == current_user.id
            )
        )
    ).scalar_one_or_none()

    if not token:
        return {"connected": False}

    return {
        "connected": True,
        "calendar_id": token.calendar_id,
        "token_expiry": token.token_expiry.isoformat() if token.token_expiry else None,
    }


@router.delete("/google/disconnect", summary="Desconectar Google Calendar")
async def google_disconnect(
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    token = (
        await db.execute(
            sa.select(GoogleCalendarToken).where(
                GoogleCalendarToken.user_id == current_user.id
            )
        )
    ).scalar_one_or_none()
    if token:
        await db.delete(token)
        await db.commit()
    return {"status": "disconnected"}


@router.post("/google/sync-meeting/{meeting_id}", summary="Sincronizar reunião com Google Calendar")
async def sync_meeting_to_google(
    meeting_id: uuid.UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    """Cria ou atualiza um evento no Google Calendar para a reunião informada."""
    from app.models.meeting import Meeting
    from app.models.client import Client, ClientPF, ClientPJ, ClientType
    from sqlalchemy.orm import selectinload

    # Busca token do usuário
    token_row = (
        await db.execute(
            sa.select(GoogleCalendarToken).where(
                GoogleCalendarToken.user_id == current_user.id
            )
        )
    ).scalar_one_or_none()
    if not token_row:
        raise HTTPException(
            status_code=400,
            detail="Google Calendar não conectado. Acesse /api/v1/integrations/google/auth-url para autorizar.",
        )

    # Busca reunião
    meeting = (
        await db.execute(
            sa.select(Meeting)
            .options(
                selectinload(Meeting.client).selectinload(Client.pf_data),
                selectinload(Meeting.client).selectinload(Client.pj_data),
                selectinload(Meeting.user),
            )
            .where(Meeting.id == meeting_id)
        )
    ).scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Reunião não encontrada.")

    # Nome do cliente
    client_name = "Cliente"
    if meeting.client:
        c = meeting.client
        if c.client_type == ClientType.PF and c.pf_data:
            client_name = c.pf_data.name
        elif c.client_type == ClientType.PJ and c.pj_data:
            client_name = c.pj_data.company_name

    creds = _creds_from_token(token_row)
    service = build("calendar", "v3", credentials=creds)

    start_dt = meeting.scheduled_at.isoformat()
    # Duração padrão: 1 hora
    from datetime import timedelta
    end_dt = (meeting.scheduled_at + timedelta(hours=1)).isoformat()

    event_body: dict[str, Any] = {
        "summary": f"[CRM] {meeting.subject or 'Reunião'} — {client_name}",
        "description": meeting.summary or "",
        "start": {"dateTime": start_dt},
        "end": {"dateTime": end_dt},
    }

    # Upsert: se já existe google_event_id na reunião, atualiza; senão cria
    google_event_id: str | None = getattr(meeting, "google_event_id", None)
    if google_event_id:
        event = (
            service.events()
            .update(
                calendarId=token_row.calendar_id,
                eventId=google_event_id,
                body=event_body,
            )
            .execute()
        )
    else:
        event = (
            service.events()
            .insert(calendarId=token_row.calendar_id, body=event_body)
            .execute()
        )
        # Persiste o ID do evento no registro da reunião (campo opcional)
        if hasattr(meeting, "google_event_id"):
            meeting.google_event_id = event["id"]
            await db.commit()

    return {"google_event_id": event.get("id"), "html_link": event.get("htmlLink")}


# ── ViaCEP ───────────────────────────────────────────────────────────────────

@router.get("/viacep/{cep}", summary="Busca endereço por CEP (ViaCEP)")
async def busca_cep(cep: str, _: InternalOnly) -> dict[str, Any]:
    """Consulta a API pública ViaCEP e retorna endereço formatado."""
    clean = cep.replace("-", "").replace(".", "").strip()
    if not clean.isdigit() or len(clean) != 8:
        raise HTTPException(status_code=422, detail="CEP inválido. Informe 8 dígitos numéricos.")

    async with httpx.AsyncClient(timeout=8.0) as client:
        try:
            resp = await client.get(f"https://viacep.com.br/ws/{clean}/json/")
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"Erro ao consultar ViaCEP: {exc}")

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="ViaCEP indisponível.")

    data = resp.json()
    if data.get("erro"):
        raise HTTPException(status_code=404, detail="CEP não encontrado.")

    return {
        "cep": data.get("cep", ""),
        "logradouro": data.get("logradouro", ""),
        "complemento": data.get("complemento", ""),
        "bairro": data.get("bairro", ""),
        "cidade": data.get("localidade", ""),
        "estado": data.get("uf", ""),
        "ibge": data.get("ibge", ""),
    }


# ── BrasilAPI — CNPJ ─────────────────────────────────────────────────────────

@router.get("/cnpj/{cnpj}", summary="Busca dados de empresa por CNPJ (BrasilAPI)")
async def busca_cnpj(cnpj: str, _: InternalOnly) -> dict[str, Any]:
    """Consulta BrasilAPI e retorna dados cadastrais da empresa."""
    clean = "".join(c for c in cnpj if c.isdigit())
    if len(clean) != 14:
        raise HTTPException(status_code=422, detail="CNPJ inválido. Informe 14 dígitos.")

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                f"https://brasilapi.com.br/api/cnpj/v1/{clean}",
                headers={"User-Agent": "CRM-Beza/1.0"},
            )
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"Erro ao consultar BrasilAPI: {exc}")

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="CNPJ não encontrado.")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="BrasilAPI indisponível.")

    data = resp.json()

    # Monta endereço completo
    parts = [
        data.get("logradouro", ""),
        data.get("numero", ""),
        data.get("complemento", ""),
        data.get("bairro", ""),
        data.get("municipio", ""),
        data.get("uf", ""),
        data.get("cep", ""),
    ]
    address = ", ".join(p for p in parts if p)

    return {
        "cnpj": clean,
        "razao_social": data.get("razao_social", ""),
        "nome_fantasia": data.get("nome_fantasia", ""),
        "situacao": data.get("descricao_situacao_cadastral", ""),
        "atividade_principal": (
            data["cnae_fiscal_descricao"]
            if data.get("cnae_fiscal_descricao")
            else ""
        ),
        "natureza_juridica": data.get("natureza_juridica", ""),
        "endereco": address,
        "logradouro": data.get("logradouro", ""),
        "numero": data.get("numero", ""),
        "complemento": data.get("complemento", ""),
        "bairro": data.get("bairro", ""),
        "cidade": data.get("municipio", ""),
        "estado": data.get("uf", ""),
        "cep": data.get("cep", ""),
        "telefone": data.get("ddd_telefone_1", ""),
        "email": data.get("email", ""),
        "data_abertura": data.get("data_inicio_atividade", ""),
        "capital_social": data.get("capital_social", 0),
        "porte": data.get("descricao_porte", ""),
    }
