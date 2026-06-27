import base64
import json
import re
from typing import Annotated
from uuid import UUID

import anthropic
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

from app.core.deps import CurrentUser, get_session
from app.crud.property import (
    add_checklist_item,
    create_property,
    get_checklist,
    get_checklist_item,
    get_property,
    list_properties,
    update_checklist_item,
    update_property,
)
from app.models.property import PROPERTY_TYPE_LABELS, ChecklistItem, Property
from app.schemas.property import (
    ChecklistItemRead,
    ChecklistItemUpdate,
    PaginatedProperties,
    PropertyClientCreate,
    PropertyClientRead,
    PropertyCreate,
    PropertyListItem,
    PropertyRead,
    PropertyUpdate,
)
from app.schemas.procedure import ChecklistItemRead as ProcChecklistItemRead

router = APIRouter()


_EXTRACT_PROMPT = """Você é um especialista em análise de matrículas de imóveis brasileiros.
Analise este documento integralmente e extraia os dados abaixo em formato JSON puro (sem markdown).

ATENÇÃO: Para os proprietários, considere SEMPRE a averbação ou registro mais recente que transferiu a propriedade.
Se houver múltiplas transferências, use os dados da última. Inclua a qualificação completa conforme consta na matrícula.

{
  "matricula": "número da matrícula (somente o número)",
  "inscricao_imobiliaria": "inscrição imobiliária municipal se houver",
  "incra_code": "código INCRA se for imóvel rural",
  "property_type": "urbano | rural | rural_urbano",
  "subtipo": "descrição física do imóvel conforme matrícula: apartamento | casa | lote urbano | lote com construção averbada | sala comercial | loja | galpão | terreno rural | terreno rural com benfeitorias | outro (especifique)",
  "endereco": "endereço completo do imóvel incluindo cidade e UF",
  "area_total": 0.0,
  "area_unit": "m2 | ha",
  "cartorio": "nome completo do cartório de registro de imóveis",
  "confrontantes": "confrontantes/lindeiros: Norte: ...; Sul: ...; Leste: ...; Oeste: ...",
  "proprietarios": [
    {
      "nome": "nome completo",
      "cpf": "CPF se pessoa física",
      "cnpj": "CNPJ se pessoa jurídica",
      "nacionalidade": "nacionalidade",
      "estado_civil": "solteiro | casado | divorciado | viúvo | separado | união estável",
      "regime_bens": "comunhão parcial | comunhão universal | separação total | participação final nos aquestos | null se não casado",
      "profissao": "profissão",
      "endereco": "endereço de qualificação do proprietário"
    }
  ]
}

Regras:
- area_total deve ser um número decimal (use ponto como separador)
- Se a área estiver em m², use area_unit "m2"; se em hectares, use "ha"
- proprietarios deve ser uma lista; se houver casal, inclua ambos como itens separados
- Se um campo não existir no documento, use null
- Retorne APENAS o JSON, sem explicações"""


@router.post("/extract-matricula")
async def extract_matricula(
    _: CurrentUser,
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
        source_block: dict = {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": b64},
        }
    else:
        source_block = {
            "type": "image",
            "source": {"type": "base64", "media_type": content_type, "data": b64},
        }

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    message = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": [source_block, {"type": "text", "text": _EXTRACT_PROMPT}]}],
    )

    raw = message.content[0].text.strip()
    # Strip markdown fences if present
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        extracted = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Não foi possível interpretar o documento.")

    return extracted


# ── Properties ────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedProperties)
async def list_props(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
):
    return await list_properties(db, page=page, page_size=page_size, search=search)


@router.post("", response_model=PropertyRead, status_code=status.HTTP_201_CREATED)
async def create_prop(
    body: PropertyCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await create_property(db, obj_in=body, created_by_id=current_user.id)


# ── Checklist items (by procedure) — ANTES de /{property_id} ─────────────────

@router.get("/checklist/{procedure_id}", response_model=list[ProcChecklistItemRead])
async def get_proc_checklist(
    procedure_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    items = await get_checklist(db, procedure_id)
    return [
        ProcChecklistItemRead(
            id=i.id,
            procedure_id=i.procedure_id,
            order=i.order,
            name=i.name,
            responsavel=i.responsavel,
            status=i.status,
            notas=i.notas,
            received_at=i.received_at,
        )
        for i in items
    ]


@router.put("/checklist/item/{item_id}", response_model=ProcChecklistItemRead)
async def update_checklist(
    item_id: UUID,
    body: ChecklistItemUpdate,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    item = await get_checklist_item(db, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado")
    updated = await update_checklist_item(db, item=item, obj_in=body)
    return ProcChecklistItemRead(
        id=updated.id,
        procedure_id=updated.procedure_id,
        order=updated.order,
        name=updated.name,
        responsavel=updated.responsavel,
        status=updated.status,
        notas=updated.notas,
        received_at=updated.received_at,
    )


@router.post("/checklist/{procedure_id}", response_model=ProcChecklistItemRead, status_code=status.HTTP_201_CREATED)
async def add_checklist(
    procedure_id: UUID,
    body: dict,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    name = body.get("name", "")
    responsavel = body.get("responsavel", "cliente")
    if not name:
        raise HTTPException(status_code=400, detail="name é obrigatório")
    item = await add_checklist_item(db, procedure_id, name, responsavel)
    return ProcChecklistItemRead(
        id=item.id,
        procedure_id=item.procedure_id,
        order=item.order,
        name=item.name,
        responsavel=item.responsavel,
        status=item.status,
        notas=item.notas,
        received_at=item.received_at,
    )


# ── Property CRUD dinâmico — DEPOIS dos paths fixos ──────────────────────────

@router.get("/{property_id}", response_model=PropertyRead)
async def get_prop(
    property_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    prop = await get_property(db, property_id)
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imóvel não encontrado")
    from app.crud.property import _to_read, _count_procedures
    count = await _count_procedures(db, property_id)
    return _to_read(prop, count)


@router.put("/{property_id}", response_model=PropertyRead)
async def update_prop(
    property_id: UUID,
    body: PropertyUpdate,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    prop = await get_property(db, property_id)
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imóvel não encontrado")
    return await update_property(db, db_obj=prop, obj_in=body)


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_prop(
    property_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    prop = await get_property(db, property_id)
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imóvel não encontrado")
    prop.is_active = False
    await db.commit()
