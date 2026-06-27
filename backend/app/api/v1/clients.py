import base64
import json
import re
from typing import Annotated
from uuid import UUID

import anthropic
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import CurrentUser, InternalOnly, get_session
from app.crud.client import crud_client
from app.models.client import ClientType
from app.models.user import UserRole
from app.schemas.client import (
    ClientPFCreate,
    ClientPFRead,
    ClientPFUpdate,
    ClientPJCreate,
    ClientPJRead,
    ClientPJUpdate,
    PaginatedClients,
)

router = APIRouter()

_EXTRACT_PF_PROMPT = """Você é um especialista em análise de documentos de identificação brasileiros (CNH, RG, RNE).
Analise este documento e extraia os dados em formato JSON puro (sem markdown):

{
  "doc_type": "CNH | RG | RNE | outro",
  "name": "nome completo conforme documento",
  "cpf": "CPF com pontos e traço: 000.000.000-00",
  "rg": "número do RG incluindo órgão emissor se houver",
  "cnh": "número da CNH se for CNH",
  "birth_date": "data de nascimento no formato YYYY-MM-DD",
  "civil_status": "solteiro | casado | divorciado | viúvo | separado | união estável | null",
  "address": "endereço completo conforme documento se houver",
  "phone": null
}

Regras:
- Se não houver o campo no documento, use null
- Retorne APENAS o JSON, sem explicações"""

_EXTRACT_PJ_PROMPT = """Você é um especialista em análise de contratos sociais, estatutos e documentos empresariais brasileiros.
Analise este documento e extraia os dados em formato JSON puro (sem markdown):

{
  "doc_type": "Contrato Social | Estatuto | CNPJ | Certidão | outro",
  "company_name": "razão social completa",
  "cnpj": "CNPJ com pontos, barra e traço: 00.000.000/0000-00",
  "address": "endereço completo da sede",
  "phone": "telefone se houver",
  "email": "e-mail se houver"
}

Regras:
- Se não houver o campo no documento, use null
- Retorne APENAS o JSON, sem explicações"""


@router.post("/extract-document")
async def extract_document(
    _: CurrentUser,
    client_type: str = "PF",
    file: UploadFile = File(...),
):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Claude API não configurada.")

    allowed = {"application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"}
    content_type = (file.content_type or "").split(";")[0].strip()
    if content_type not in allowed:
        raise HTTPException(status_code=400, detail="Formato não suportado. Envie PDF, JPG ou PNG.")

    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Arquivo muito grande (máx 20 MB).")

    b64 = base64.standard_b64encode(data).decode()
    if content_type == "application/pdf":
        source_block: dict = {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}}
    else:
        source_block = {"type": "image", "source": {"type": "base64", "media_type": content_type, "data": b64}}

    prompt = _EXTRACT_PF_PROMPT if client_type.upper() == "PF" else _EXTRACT_PJ_PROMPT

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    message = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": [source_block, {"type": "text", "text": prompt}]}],
    )

    raw = message.content[0].text.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        extracted = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Não foi possível interpretar o documento.")

    return extracted


def _can_delete(user) -> bool:
    return user.role in (UserRole.admin, UserRole.advogado)


@router.get("", response_model=PaginatedClients)
async def list_clients(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    client_type: ClientType | None = Query(None),
    active_only: bool = Query(True),
):
    return await crud_client.list_paginated(
        db,
        page=page,
        page_size=page_size,
        search=search,
        client_type=client_type,
        active_only=active_only,
    )


@router.post("/pf", response_model=ClientPFRead, status_code=status.HTTP_201_CREATED)
async def create_client_pf(
    body: ClientPFCreate,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        return await crud_client.create_pf(db, obj_in=body, created_by_id=current_user.id)
    except IntegrityError as exc:
        await db.rollback()
        if "cpf" in str(exc.orig).lower():
            raise HTTPException(status_code=409, detail="Já existe um cliente cadastrado com este CPF.")
        raise HTTPException(status_code=409, detail="Dados duplicados. Verifique as informações.")


@router.post("/pj", response_model=ClientPJRead, status_code=status.HTTP_201_CREATED)
async def create_client_pj(
    body: ClientPJCreate,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        return await crud_client.create_pj(db, obj_in=body, created_by_id=current_user.id)
    except IntegrityError as exc:
        await db.rollback()
        if "cnpj" in str(exc.orig).lower():
            raise HTTPException(status_code=409, detail="Já existe um cliente cadastrado com este CNPJ.")
        raise HTTPException(status_code=409, detail="Dados duplicados. Verifique as informações.")


@router.get("/{client_id}", response_model=ClientPFRead | ClientPJRead)
async def get_client(
    client_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    client = await crud_client.get_with_data(db, client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    return client


@router.put("/{client_id}/pf", response_model=ClientPFRead)
async def update_client_pf(
    client_id: UUID,
    body: ClientPFUpdate,
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    client = await crud_client.get_with_data(db, client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    if client.client_type != ClientType.PF:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cliente não é PF")
    return await crud_client.update_pf(db, db_obj=client, obj_in=body)


@router.put("/{client_id}/pj", response_model=ClientPJRead)
async def update_client_pj(
    client_id: UUID,
    body: ClientPJUpdate,
    _: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    client = await crud_client.get_with_data(db, client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    if client.client_type != ClientType.PJ:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cliente não é PJ")
    return await crud_client.update_pj(db, db_obj=client, obj_in=body)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    if not _can_delete(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas admin ou advogado podem desativar clientes",
        )
    client = await crud_client.soft_delete(db, id=client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
