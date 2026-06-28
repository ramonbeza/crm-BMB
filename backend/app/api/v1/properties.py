import base64
import json
import re
from typing import Annotated
from uuid import UUID

import anthropic
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
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


_ANALYZE_PROMPT = """Você é um advogado especialista em Direito Registral Imobiliário brasileiro.
Analise esta matrícula de imóvel integralmente — incluindo todos os registros e averbações — e produza um parecer jurídico estruturado em formato JSON puro (sem markdown).

{
  "situacao_geral": "regular | com_onus | irregular | requer_investigacao",
  "nivel_risco": "baixo | medio | alto",
  "resumo": "parágrafo curto com a situação geral do imóvel",
  "onus_reais": [
    {
      "tipo": "hipoteca | penhora | usufruto | alienacao_fiduciaria | servidao | restricao_legal | outro",
      "descricao": "descrição detalhada conforme matrícula",
      "data_registro": "data do registro/averbação se constar",
      "credor_beneficiario": "nome do credor ou beneficiário se constar",
      "situacao": "ativo | cancelado | incerto"
    }
  ],
  "historico_transmissoes": [
    {
      "ordem": 1,
      "tipo": "compra e venda | doação | herança | permuta | arrematação | outro",
      "de": "nome do transmitente",
      "para": "nome do adquirente",
      "data": "data da transmissão",
      "valor": "valor se constar"
    }
  ],
  "inconsistencias": [
    {
      "tipo": "area_divergente | confrontantes_imprecisos | proprietario_sem_qualificacao | registro_incompleto | outro",
      "descricao": "descrição da inconsistência identificada",
      "gravidade": "baixa | media | alta"
    }
  ],
  "documentos_recomendados": [
    "certidão de ônus reais atualizada (≤30 dias)",
    "outros documentos específicos recomendados para o caso"
  ],
  "recomendacoes": [
    "recomendação jurídica específica baseada na análise"
  ]
}

Regras:
- Analise TODOS os registros e averbações, não apenas os mais recentes
- Se não houver ônus, transmissões ou inconsistências, retorne listas vazias []
- situacao_geral "regular" = sem ônus ativos e transmissões em ordem
- situacao_geral "com_onus" = há ônus ativos (hipoteca, penhora, etc.)
- situacao_geral "irregular" = problemas graves que impedem negócios
- situacao_geral "requer_investigacao" = há dúvidas que precisam de apuração
- Retorne APENAS o JSON, sem explicações"""


_FULL_EXTRACT_PROMPT = """Você é um advogado especialista em Direito Registral Imobiliário e engenheiro com expertise em NBR 12721.
Analise esta matrícula de imóvel INTEGRALMENTE — todos os registros e averbações — e retorne APENAS um JSON puro (sem markdown) com três seções:

{
  "dados": {
    "matricula": "número da matrícula (somente o número)",
    "inscricao_imobiliaria": "inscrição imobiliária municipal se houver",
    "incra_code": "código INCRA se for imóvel rural",
    "property_type": "urbano | rural | rural_urbano",
    "subtipo": "tipo físico: Apartamento | Casa | Lote urbano | Lote com construção averbada | Sala comercial | Loja | Galpão / armazém | Terreno rural | Terreno rural com benfeitorias | Outro",
    "endereco": "endereço completo incluindo cidade e UF",
    "area_total": 0.0,
    "area_unit": "m2 | ha",
    "cartorio": "nome completo do cartório de registro de imóveis",
    "confrontantes": "Norte: ...; Sul: ...; Leste: ...; Oeste: ...",
    "proprietarios": [
      {
        "nome": "nome completo",
        "cpf": "CPF se PF",
        "cnpj": "CNPJ se PJ",
        "nacionalidade": "nacionalidade",
        "estado_civil": "solteiro | casado | divorciado | viúvo | separado | união estável",
        "regime_bens": "comunhão parcial | comunhão universal | separação total | participação final nos aquestos | null se solteiro/viúvo",
        "profissao": "profissão",
        "endereco": "endereço de qualificação"
      }
    ]
  },
  "analise_juridica": {
    "situacao_geral": "regular | com_onus | irregular | requer_investigacao",
    "nivel_risco": "baixo | medio | alto",
    "resumo": "parágrafo curto com a situação geral do imóvel",
    "onus_reais": [
      {
        "tipo": "hipoteca | penhora | usufruto | alienacao_fiduciaria | servidao | restricao_legal | outro",
        "descricao": "descrição detalhada conforme matrícula",
        "data_registro": "data do registro/averbação se constar",
        "credor_beneficiario": "nome do credor ou beneficiário se constar",
        "situacao": "ativo | cancelado | incerto"
      }
    ],
    "historico_transmissoes": [
      {
        "ordem": 1,
        "tipo": "compra e venda | doação | herança | permuta | arrematação | outro",
        "de": "nome do transmitente",
        "para": "nome do adquirente",
        "data": "data da transmissão",
        "valor": "valor se constar"
      }
    ],
    "inconsistencias": [
      {
        "tipo": "area_divergente | confrontantes_imprecisos | proprietario_sem_qualificacao | registro_incompleto | outro",
        "descricao": "descrição da inconsistência",
        "gravidade": "baixa | media | alta"
      }
    ],
    "documentos_recomendados": ["certidão de ônus reais atualizada (≤30 dias)"],
    "recomendacoes": ["recomendação jurídica específica"]
  },
  "quadro_areas_nbr": null
}

ATENÇÃO para quadro_areas_nbr:
- Retorne null se a matrícula for de imóvel simples (casa, lote, apartamento individual, terreno rural).
- Retorne o objeto abaixo APENAS se a matrícula se referir a um edifício em condomínio ou incorporação com múltiplas unidades:

{
  "nome_empreendimento": "nome do empreendimento",
  "endereco": "endereço",
  "numero_pavimentos": 0,
  "total_unidades": 0,
  "unidades": [
    {
      "id_unidade": "101",
      "tipo": "apartamento | sala_comercial | vaga_garagem | deposito | loja | outro",
      "descricao": "descrição completa",
      "pavimento": "1º Pavimento",
      "area_privativa_real": 0.00,
      "area_comum_real": 0.00,
      "area_total_real": 0.00,
      "area_privativa_equivalente": 0.00,
      "area_comum_equivalente": 0.00,
      "area_total_equivalente": 0.00,
      "fracao_ideal_terreno": null,
      "coeficiente_proporcionalidade": 1.000,
      "dormitorios": null,
      "vagas": null,
      "observacoes": null
    }
  ],
  "totais": {
    "area_privativa_real": 0.00,
    "area_comum_real": 0.00,
    "area_total_real": 0.00,
    "area_privativa_equivalente": 0.00,
    "area_comum_equivalente": 0.00,
    "area_total_equivalente": 0.00
  },
  "observacoes_gerais": null
}

Regras gerais:
- Para proprietários, use SEMPRE os dados da averbação/registro mais recente que transferiu a propriedade
- area_total deve ser número decimal com ponto como separador
- Se campo não existir no documento, use null
- Não inclua markdown, blocos de código ou explicações — apenas o JSON"""


@router.post("/extract-full")
async def extract_full_matricula(
    _: CurrentUser,
    file: UploadFile = File(...),
):
    """Uma única chamada ao Claude: extrai dados do imóvel + análise jurídica + quadro NBR 12721."""
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

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=180.0)
    message = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=8192,
        messages=[{"role": "user", "content": [source_block, {"type": "text", "text": _FULL_EXTRACT_PROMPT}]}],
    )

    raw = message.content[0].text.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Não foi possível interpretar o documento.")

    return result


@router.post("/analyze-matricula")
async def analyze_matricula(
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
        source_block: dict = {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}}
    else:
        source_block = {"type": "image", "source": {"type": "base64", "media_type": content_type, "data": b64}}

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=120.0)
    message = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": [source_block, {"type": "text", "text": _ANALYZE_PROMPT}]}],
    )

    raw = message.content[0].text.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Não foi possível gerar a análise.")

    return result


@router.post("/analyze-matricula-stream")
async def analyze_matricula_stream(
    _: CurrentUser,
    file: UploadFile = File(...),
):
    """Análise jurídica da matrícula com streaming SSE — texto aparece em tempo real."""
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

    async def event_generator():
        try:
            async_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=180.0)
            async with async_client.messages.stream(
                model=settings.CLAUDE_MODEL,
                max_tokens=4096,
                messages=[{"role": "user", "content": [source_block, {"type": "text", "text": _ANALYZE_PROMPT}]}],
            ) as stream:
                async for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


_NBR_PROMPT = """Você é um engenheiro e especialista em NBR 12721 (Avaliação de custos unitários e preparo de orçamento de construção para incorporação de edifício em condomínio).
Analise as plantas, memoriais e documentos fornecidos e extraia o quadro de áreas conforme a NBR 12721, retornando APENAS JSON puro (sem markdown).

{
  "nome_empreendimento": "nome do empreendimento se constar",
  "endereco": "endereço do empreendimento",
  "numero_pavimentos": 0,
  "total_unidades": 0,
  "unidades": [
    {
      "id_unidade": "identificador único da unidade (ex: 101, Vaga 01, Depósito 01)",
      "tipo": "apartamento | sala_comercial | vaga_garagem | deposito | loja | outro",
      "descricao": "descrição completa (ex: Apartamento 101 - 1º Pavimento)",
      "pavimento": "pavimento onde se localiza (ex: 1º Pavimento, Subsolo)",
      "area_privativa_real": 0.00,
      "area_comum_real": 0.00,
      "area_total_real": 0.00,
      "area_privativa_equivalente": 0.00,
      "area_comum_equivalente": 0.00,
      "area_total_equivalente": 0.00,
      "fracao_ideal_terreno": "fração ideal do terreno (ex: 1/100 ou 0.0100 ou null se não constar)",
      "coeficiente_proporcionalidade": 1.000,
      "dormitorios": null,
      "vagas": null,
      "observacoes": null
    }
  ],
  "totais": {
    "area_privativa_real": 0.00,
    "area_comum_real": 0.00,
    "area_total_real": 0.00,
    "area_privativa_equivalente": 0.00,
    "area_comum_equivalente": 0.00,
    "area_total_equivalente": 0.00
  },
  "observacoes_gerais": "observações relevantes sobre o quadro de áreas"
}

Regras importantes:
- Extraia TODAS as unidades autônomas (apartamentos, vagas, depósitos, lojas, etc.)
- Área real = área conforme medição física (planta)
- Área equivalente = área real × coeficiente de equivalência construtiva (se não constar, use null)
- Se a planta não discriminar área comum por unidade, calcule pela fração ideal se disponível
- area_total_real = area_privativa_real + area_comum_real
- Use ponto (.) como separador decimal
- Se um valor não constar no documento, use null
- Retorne APENAS o JSON, sem explicações adicionais"""


@router.post("/{property_id}/extract-nbr-areas")
async def extract_nbr_areas(
    property_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    files: list[UploadFile] = File(...),
):
    """Extrai quadro de áreas NBR 12721 a partir de plantas e documentos."""
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Claude API não configurada.")

    prop = await get_property(db, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    if not files:
        raise HTTPException(status_code=400, detail="Envie ao menos um arquivo.")

    allowed = {"application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"}
    content_blocks: list[dict] = []

    for file in files:
        content_type = (file.content_type or "").split(";")[0].strip()
        if content_type not in allowed:
            raise HTTPException(status_code=400, detail=f"Formato não suportado: {file.filename}")
        data = await file.read()
        if len(data) > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"Arquivo muito grande: {file.filename} (máx 20 MB).")
        b64 = base64.standard_b64encode(data).decode()
        if content_type == "application/pdf":
            content_blocks.append({"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}})
        else:
            content_blocks.append({"type": "image", "source": {"type": "base64", "media_type": content_type, "data": b64}})

    content_blocks.append({"type": "text", "text": _NBR_PROMPT})

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=180.0)
    message = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=8192,
        messages=[{"role": "user", "content": content_blocks}],
    )

    raw = message.content[0].text.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Não foi possível extrair o quadro de áreas.")

    return result


@router.put("/{property_id}/nbr-areas")
async def save_nbr_areas(
    property_id: UUID,
    body: dict,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    """Salva o quadro de áreas NBR 12721 no imóvel."""
    prop = await get_property(db, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")
    prop.quadro_areas_nbr = body
    await db.commit()
    await db.refresh(prop)
    from app.crud.property import _to_read, _count_procedures
    count = await _count_procedures(db, property_id)
    return _to_read(prop, count)


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
