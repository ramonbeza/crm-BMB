"""
Sprint 10 — API de geração de documentos com IA (Claude API).
"""
from __future__ import annotations

import uuid
from typing import Annotated, Any

import sqlalchemy as sa
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.deps import CurrentUser
from app.db.session import get_session
from app.models.ai_document import AIDocument, AIDocumentStatus, AI_DOCUMENT_LABELS, SUGGESTED_DOCS_BY_PROCEDURE
from app.models.document import ExtractedDocument
from app.models.procedure import Procedure
from app.models.client import Client, ClientType

router = APIRouter()

# ── helpers ───────────────────────────────────────────────────────────────────

def _client_name(client: Client | None) -> str:
    if not client:
        return "[CLIENTE]"
    if client.client_type == ClientType.PF and client.pf_data:
        return client.pf_data.name
    if client.client_type == ClientType.PJ and client.pj_data:
        return client.pj_data.company_name
    return "[CLIENTE]"

def _client_doc(client: Client | None) -> str:
    if not client:
        return ""
    if client.client_type == ClientType.PF and client.pf_data:
        return client.pf_data.cpf or ""
    if client.client_type == ClientType.PJ and client.pj_data:
        return client.pj_data.cnpj or ""
    return ""

def _client_address(client: Client | None) -> str:
    if not client:
        return ""
    if client.client_type == ClientType.PF and client.pf_data:
        return client.pf_data.address or ""
    if client.client_type == ClientType.PJ and client.pj_data:
        return client.pj_data.address or ""
    return ""

def _proc_number(p: Procedure) -> str:
    from datetime import datetime
    year = p.opened_at.year if p.opened_at else datetime.now().year
    return f"BMB-{year}-{str(p.protocol_number).zfill(4)}"


# ── schemas ───────────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    doc_type: str
    extra_instructions: str = ""
    # Campos opcionais para enriquecer o prompt
    notified_name: str = ""
    notified_address: str = ""
    notification_subject: str = ""
    declaration_subject: str = ""
    legal_question: str = ""
    powers: str = ""
    other_parties: str = ""
    contract_object: str = ""


class AIDocRead(BaseModel):
    model_config = {"protected_namespaces": ()}

    id: str
    procedure_id: str
    doc_type: str
    doc_type_label: str
    status: str
    content: str | None
    error_message: str | None
    model_used: str | None
    tokens_input: int | None
    tokens_output: int | None
    created_at: str
    updated_at: str

    @classmethod
    def from_orm(cls, d: AIDocument) -> "AIDocRead":
        return cls(
            id=str(d.id),
            procedure_id=str(d.procedure_id),
            doc_type=d.doc_type,
            doc_type_label=AI_DOCUMENT_LABELS.get(d.doc_type, d.doc_type),
            status=d.status,
            content=d.content,
            error_message=d.error_message,
            model_used=d.model_used,
            tokens_input=d.tokens_input,
            tokens_output=d.tokens_output,
            created_at=d.created_at.isoformat(),
            updated_at=d.updated_at.isoformat(),
        )


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/types", summary="Lista tipos de documento disponíveis")
async def list_doc_types(_: CurrentUser) -> list[dict[str, str]]:
    return [{"value": k, "label": v} for k, v in AI_DOCUMENT_LABELS.items()]


@router.get("/types/procedure/{procedure_type}", summary="Lista tipos sugeridos por tipo de procedimento")
async def list_suggested_types(_: CurrentUser, procedure_type: str) -> list[dict[str, str]]:
    suggested = SUGGESTED_DOCS_BY_PROCEDURE.get(procedure_type, [])
    result = []
    seen = set()
    for key in suggested:
        if key in AI_DOCUMENT_LABELS:
            result.append({"value": key, "label": AI_DOCUMENT_LABELS[key], "suggested": True})
            seen.add(key)
    for key, label in AI_DOCUMENT_LABELS.items():
        if key not in seen:
            result.append({"value": key, "label": label, "suggested": False})
    return result


async def _run_generation(doc_id: str, doc_type: str, context: dict) -> None:
    """Executa a geração de documento em background no próprio processo FastAPI."""
    import re
    import anthropic
    from app.core.config import settings
    from app.db.session import AsyncSessionLocal
    from app.worker.ai_prompts import SYSTEM_PROMPT, build_prompt

    async with AsyncSessionLocal() as session:
        doc = await session.get(AIDocument, uuid.UUID(doc_id))
        if not doc:
            return
        doc.status = AIDocumentStatus.GENERATING
        await session.commit()

        try:
            if not settings.ANTHROPIC_API_KEY:
                raise ValueError("ANTHROPIC_API_KEY não configurado")

            client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=120.0)
            user_prompt = build_prompt(doc_type, context)

            message = client.messages.create(
                model=settings.CLAUDE_MODEL,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )

            content = message.content[0].text if message.content else ""
            doc.status = AIDocumentStatus.DONE
            doc.content = content
            doc.model_used = settings.CLAUDE_MODEL
            doc.tokens_input = message.usage.input_tokens
            doc.tokens_output = message.usage.output_tokens
            doc.prompt_used = user_prompt

        except Exception as exc:
            doc.status = AIDocumentStatus.FAILED
            doc.error_message = str(exc)

        await session.commit()


@router.post("/procedures/{procedure_id}/generate", summary="Solicita geração de documento por IA")
async def generate_document(
    procedure_id: uuid.UUID,
    req: GenerateRequest,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> AIDocRead:
    """Cria um registro AIDocument e dispara a task Celery de geração."""
    from app.models.procedure import PROCEDURE_TYPE_LABELS

    # Carrega o procedimento com client e responsible
    proc = (
        await db.execute(
            sa.select(Procedure)
            .options(
                selectinload(Procedure.client).selectinload(Client.pf_data),
                selectinload(Procedure.client).selectinload(Client.pj_data),
                selectinload(Procedure.responsible),
                selectinload(Procedure.stages),
            )
            .where(Procedure.id == procedure_id)
        )
    ).scalar_one_or_none()

    if not proc:
        raise HTTPException(status_code=404, detail="Procedimento não encontrado.")

    # Monta contexto para o prompt
    stages_summary = "; ".join(
        f"{s.name}: {s.status}" for s in (proc.stages or [])
    )

    # Carrega documentos extraídos do procedimento para enriquecer o prompt
    extracted_docs = (await db.execute(
        sa.select(ExtractedDocument)
        .where(ExtractedDocument.procedure_id == procedure_id)
        .where(ExtractedDocument.status == "extraido")
        .order_by(ExtractedDocument.created_at)
    )).scalars().all()

    extracted_docs_summary = ""
    if extracted_docs:
        lines = []
        for d in extracted_docs:
            if not d.extracted_data:
                continue
            ed = d.extracted_data
            label = d.doc_type_label or d.doc_type or "Documento"
            resumo = ed.get("resumo", "")
            data_em = ed.get("data_emissao", "")
            validade = ed.get("validade", "")
            partes = ed.get("partes", [])
            campos = ed.get("campos", {})
            imovel = ed.get("imovel", {})
            info_parts = [f"[{label}] {d.filename}"]
            if resumo:
                info_parts.append(f"  Resumo: {resumo}")
            if data_em:
                info_parts.append(f"  Data emissão: {data_em}")
            if validade:
                info_parts.append(f"  Validade: {validade}")
            if partes:
                for p in partes[:4]:
                    info_parts.append(f"  {p.get('papel','')}: {p.get('nome','')} {p.get('cpf_cnpj','')}")
            if campos:
                for k, v in list(campos.items())[:6]:
                    if v:
                        info_parts.append(f"  {k}: {v}")
            if imovel:
                for k, v in imovel.items():
                    if v:
                        info_parts.append(f"  Imóvel ({k}): {v}")
            lines.append("\n".join(info_parts))
        extracted_docs_summary = "\n\n".join(lines)

    # Carrega proprietários do imóvel vinculado ao procedimento (se houver)
    proprietarios_summary = ""
    if proc.property_id:
        from app.models.property import Property
        prop_obj = await db.get(Property, proc.property_id)
        if prop_obj and prop_obj.proprietarios:
            prop_lines = []
            for p in prop_obj.proprietarios:
                parts = [p.get("nome", "")]
                if p.get("cpf"):
                    parts.append(f"CPF: {p['cpf']}")
                if p.get("cnpj"):
                    parts.append(f"CNPJ: {p['cnpj']}")
                if p.get("estado_civil"):
                    ec = p["estado_civil"]
                    if p.get("regime_bens"):
                        ec += f" ({p['regime_bens']})"
                    parts.append(ec)
                if p.get("profissao"):
                    parts.append(p["profissao"])
                if p.get("nacionalidade"):
                    parts.append(p["nacionalidade"])
                if p.get("endereco"):
                    parts.append(p["endereco"])
                prop_lines.append(", ".join(filter(None, parts)))
            proprietarios_summary = "\n".join(prop_lines)

    context: dict[str, Any] = {
        "client_name": _client_name(proc.client),
        "client_document": _client_doc(proc.client),
        "client_address": _client_address(proc.client),
        "procedure_type": proc.procedure_type,
        "procedure_type_label": PROCEDURE_TYPE_LABELS.get(proc.procedure_type, proc.procedure_type),
        "procedure_number": _proc_number(proc),
        "property_description": proc.property_description or "",
        "matricula": proc.matricula or "",
        "responsible_name": proc.responsible.name if proc.responsible else "Advogado Responsável",
        "stages_summary": stages_summary,
        "extra_instructions": req.extra_instructions,
        "extracted_docs_summary": extracted_docs_summary,
        "proprietarios_summary": proprietarios_summary,
        # Campos opcionais passados pelo usuário
        "notified_name": req.notified_name,
        "notified_address": req.notified_address,
        "notification_subject": req.notification_subject,
        "declaration_subject": req.declaration_subject,
        "legal_question": req.legal_question,
        "powers": req.powers,
        "other_parties": req.other_parties,
        "contract_object": req.contract_object,
    }

    # Cria o registro
    doc = AIDocument(
        procedure_id=procedure_id,
        requested_by_id=current_user.id,
        doc_type=req.doc_type,
        status=AIDocumentStatus.PENDING,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Dispara geração em background (sem depender do worker Celery)
    background_tasks.add_task(_run_generation, str(doc.id), req.doc_type, context)

    return AIDocRead.from_orm(doc)


@router.get("/procedures/{procedure_id}/documents", summary="Lista documentos IA de um procedimento")
async def list_documents(
    procedure_id: uuid.UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> list[AIDocRead]:
    docs = (
        await db.execute(
            sa.select(AIDocument)
            .where(AIDocument.procedure_id == procedure_id)
            .order_by(AIDocument.created_at.desc())
        )
    ).scalars().all()
    return [AIDocRead.from_orm(d) for d in docs]


@router.get("/documents/{doc_id}", summary="Obtém documento IA por ID")
async def get_document(
    doc_id: uuid.UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> AIDocRead:
    doc = (
        await db.execute(sa.select(AIDocument).where(AIDocument.id == doc_id))
    ).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    return AIDocRead.from_orm(doc)


@router.get("/documents/{doc_id}/text", summary="Retorna conteúdo do documento como texto puro")
async def get_document_text(
    doc_id: uuid.UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> PlainTextResponse:
    doc = (
        await db.execute(sa.select(AIDocument).where(AIDocument.id == doc_id))
    ).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    if doc.status != AIDocumentStatus.DONE:
        raise HTTPException(status_code=409, detail=f"Documento ainda não concluído (status: {doc.status}).")
    return PlainTextResponse(content=doc.content or "")


@router.delete("/documents/{doc_id}", summary="Exclui documento IA")
async def delete_document(
    doc_id: uuid.UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    doc = (
        await db.execute(sa.select(AIDocument).where(AIDocument.id == doc_id))
    ).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    await db.delete(doc)
    await db.commit()
    return Response(status_code=204)


# ── Assistente de fluxo ───────────────────────────────────────────────────────

_WORKFLOW_PROMPT = """Você é um assistente jurídico especializado em procedimentos imobiliários extrajudiciais.
Analise o estado atual do procedimento e produza sugestões práticas em JSON puro (sem markdown).

{
  "resumo": "análise geral em 2-3 frases do estado do procedimento",
  "progresso_estimado": 0,
  "checklist_sugeridos": [
    {
      "item_id": "uuid do item",
      "item_nome": "nome do item de checklist",
      "novo_status": "recebido",
      "justificativa": "qual documento extraído satisfaz este item"
    }
  ],
  "pode_avancar_etapa": false,
  "avaliacao_etapa_atual": "avaliação da etapa atual — o que falta para avançar",
  "documentos_faltantes": [
    {
      "nome": "nome do documento necessário",
      "urgencia": "alta | media | baixa",
      "responsavel": "cliente | escritorio",
      "observacao": "detalhe adicional se necessário"
    }
  ],
  "documentos_gerar": [
    {
      "doc_type": "chave técnica do documento",
      "label": "nome legível",
      "justificativa": "por que gerar este documento agora"
    }
  ],
  "proximas_acoes": [
    "ação concreta e específica recomendada"
  ]
}

Regras:
- checklist_sugeridos: liste APENAS itens que você pode confirmar com base nos documentos extraídos fornecidos
- progresso_estimado: percentual de 0 a 100 baseado em etapas concluídas e checklist atendido
- pode_avancar_etapa: true somente se a etapa atual estiver com todos os requisitos atendidos
- documentos_gerar: liste apenas documentos que fazem sentido neste momento do procedimento
- proximas_acoes: seja específico (ex: "Solicitar ao cliente a certidão de matrícula atualizada do CRI de Curitiba")
- Retorne APENAS o JSON, sem explicações"""


@router.post("/procedures/{procedure_id}/suggest-workflow", summary="Análise de fluxo e sugestões da IA")
async def suggest_workflow(
    procedure_id: uuid.UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> dict:
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Claude API não configurada.")

    import json, re
    import anthropic
    from app.models.procedure import PROCEDURE_TYPE_LABELS
    from app.models.property import Property

    # Carrega procedimento completo
    proc = (await db.execute(
        sa.select(Procedure)
        .options(
            selectinload(Procedure.client).selectinload(Client.pf_data),
            selectinload(Procedure.client).selectinload(Client.pj_data),
            selectinload(Procedure.responsible),
            selectinload(Procedure.stages),
        )
        .where(Procedure.id == procedure_id)
    )).scalar_one_or_none()

    if not proc:
        raise HTTPException(status_code=404, detail="Procedimento não encontrado.")

    # Checklist items
    from app.models.property import ChecklistItem
    checklist = (await db.execute(
        sa.select(ChecklistItem)
        .where(ChecklistItem.procedure_id == procedure_id)
        .order_by(ChecklistItem.order)
    )).scalars().all()

    # Documentos extraídos
    extracted_docs = (await db.execute(
        sa.select(ExtractedDocument)
        .where(ExtractedDocument.procedure_id == procedure_id)
        .where(ExtractedDocument.status == "extraido")
        .order_by(ExtractedDocument.created_at)
    )).scalars().all()

    # Constrói contexto textual
    proc_label = PROCEDURE_TYPE_LABELS.get(proc.procedure_type, proc.procedure_type)
    stages_text = "\n".join(
        f"  - {s.name}: {s.status}" for s in (proc.stages or [])
    )
    checklist_text = "\n".join(
        f"  - [{item.id}] {item.name} (responsável: {item.responsavel}, status: {item.status})"
        for item in checklist
    ) or "  Sem itens de checklist."

    docs_text_parts = []
    for d in extracted_docs:
        if not d.extracted_data:
            continue
        ed = d.extracted_data
        label = d.doc_type_label or d.doc_type or "Documento"
        lines = [f"  [{label}] {d.filename}"]
        if ed.get("resumo"):
            lines.append(f"    Resumo: {ed['resumo']}")
        if ed.get("data_emissao"):
            lines.append(f"    Data emissão: {ed['data_emissao']}")
        if ed.get("validade"):
            lines.append(f"    Validade: {ed['validade']}")
        alertas = ed.get("alertas", [])
        if alertas:
            lines.append(f"    Alertas: {', '.join(alertas)}")
        docs_text_parts.append("\n".join(lines))
    docs_text = "\n\n".join(docs_text_parts) or "  Nenhum documento extraído ainda."

    # Documentos IA já gerados
    ai_docs = (await db.execute(
        sa.select(AIDocument)
        .where(AIDocument.procedure_id == procedure_id)
        .where(AIDocument.status == AIDocumentStatus.DONE)
    )).scalars().all()
    ai_docs_text = ", ".join(AI_DOCUMENT_LABELS.get(d.doc_type, d.doc_type) for d in ai_docs) or "Nenhum"

    # Documentos sugeridos para este tipo
    suggested = SUGGESTED_DOCS_BY_PROCEDURE.get(proc.procedure_type, [])
    suggested_text = ", ".join(AI_DOCUMENT_LABELS.get(k, k) for k in suggested)

    user_msg = f"""PROCEDIMENTO: {proc_label} — {_proc_number(proc)}
CLIENTE: {_client_name(proc.client)} ({_client_doc(proc.client)})
IMÓVEL: {proc.property_description or "[não informado]"}
MATRÍCULA: {proc.matricula or "[não informada]"}
RESPONSÁVEL: {proc.responsible.name if proc.responsible else "Advogado Responsável"}

ETAPAS DO PROCEDIMENTO:
{stages_text or "  Sem etapas registradas."}

CHECKLIST DE DOCUMENTOS:
{checklist_text}

DOCUMENTOS EXTRAÍDOS COM IA:
{docs_text}

DOCUMENTOS JURÍDICOS JÁ GERADOS: {ai_docs_text}
DOCUMENTOS SUGERIDOS PARA ESTE TIPO DE PROCEDIMENTO: {suggested_text}

Com base nestas informações, produza a análise de fluxo conforme o schema solicitado.
{_WORKFLOW_PROMPT}"""

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=120.0)
    message = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": user_msg}],
    )
    raw = message.content[0].text.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Não foi possível gerar a análise de fluxo.")
