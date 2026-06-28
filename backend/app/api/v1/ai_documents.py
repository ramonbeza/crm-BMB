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

from app.core.deps import CurrentUser
from app.db.session import get_session
from app.models.ai_document import AIDocument, AIDocumentStatus, AI_DOCUMENT_LABELS
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
    context: dict[str, Any] = {
        "client_name": _client_name(proc.client),
        "client_document": _client_doc(proc.client),
        "client_address": _client_address(proc.client),
        "procedure_type_label": PROCEDURE_TYPE_LABELS.get(proc.procedure_type, proc.procedure_type),
        "procedure_number": _proc_number(proc),
        "property_description": proc.property_description or "",
        "matricula": proc.matricula or "",
        "responsible_name": proc.responsible.name if proc.responsible else "Advogado Responsável",
        "stages_summary": stages_summary,
        "extra_instructions": req.extra_instructions,
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
