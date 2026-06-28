"""Banco de Leis e Normas — upload, listagem, exclusão e consulta por IA."""
from __future__ import annotations

import base64
import json
from typing import Annotated
from uuid import UUID

import anthropic
import sqlalchemy as sa
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import CurrentUser, get_session
from app.models.legal_document import LEGAL_DOC_SCOPE_LABELS, LEGAL_DOC_TYPE_LABELS, LegalDocument
from app.models.procedure import PROCEDURE_TYPE_LABELS

router = APIRouter()

MAX_FILE_SIZE = 30 * 1024 * 1024  # 30 MB
ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class LegalDocRead(BaseModel):
    id: str
    name: str
    doc_type: str
    doc_type_label: str
    scope: str
    scope_label: str
    municipio: str | None
    estado: str | None
    numero: str | None
    ano: str | None
    descricao: str | None
    summary: str | None
    content_type: str | None
    file_size: int | None
    has_file: bool

    model_config = {"from_attributes": True}


def _to_read(doc: LegalDocument) -> LegalDocRead:
    return LegalDocRead(
        id=str(doc.id),
        name=doc.name,
        doc_type=doc.doc_type,
        doc_type_label=LEGAL_DOC_TYPE_LABELS.get(doc.doc_type, doc.doc_type),
        scope=doc.scope,
        scope_label=LEGAL_DOC_SCOPE_LABELS.get(doc.scope, doc.scope),
        municipio=doc.municipio,
        estado=doc.estado,
        numero=doc.numero,
        ano=doc.ano,
        descricao=doc.descricao,
        summary=doc.summary,
        content_type=doc.content_type,
        file_size=doc.file_size,
        has_file=bool(doc.content_b64),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[LegalDocRead])
async def list_legal_docs(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    result = await db.execute(
        sa.select(LegalDocument)
        .where(LegalDocument.is_active == True)
        .order_by(LegalDocument.scope, LegalDocument.doc_type, LegalDocument.name)
    )
    return [_to_read(d) for d in result.scalars().all()]


@router.post("", response_model=LegalDocRead, status_code=status.HTTP_201_CREATED)
async def upload_legal_doc(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    name: str = Form(...),
    doc_type: str = Form(...),
    scope: str = Form("municipal"),
    municipio: str | None = Form(None),
    estado: str | None = Form(None),
    numero: str | None = Form(None),
    ano: str | None = Form(None),
    descricao: str | None = Form(None),
    file: UploadFile | None = File(None),
):
    content_b64: str | None = None
    content_type: str | None = None
    file_size: int | None = None

    if file and file.filename:
        ct = (file.content_type or "").split(";")[0].strip()
        if ct not in ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail="Formato não suportado. Use PDF, JPG ou PNG.")
        data = await file.read()
        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Arquivo muito grande (máx 30 MB).")
        content_b64 = base64.standard_b64encode(data).decode()
        content_type = ct
        file_size = len(data)

    doc = LegalDocument(
        name=name,
        doc_type=doc_type,
        scope=scope,
        municipio=municipio or None,
        estado=estado or None,
        numero=numero or None,
        ano=ano or None,
        descricao=descricao or None,
        content_b64=content_b64,
        content_type=content_type,
        file_size=file_size,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return _to_read(doc)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_legal_doc(
    doc_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    result = await db.execute(sa.select(LegalDocument).where(LegalDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    doc.is_active = False
    await db.commit()


class ConsultRequest(BaseModel):
    procedure_type: str
    doc_ids: list[str]
    municipio: str | None = None
    additional_context: str | None = None


_CONSULT_PROMPT = """Você é um especialista em direito imobiliário e registros públicos brasileiro.

Com base na legislação e normas fornecidas abaixo, gere uma lista completa e detalhada dos documentos necessários para o seguinte procedimento: **{procedure_type}**

{municipio_info}
{context}

Legislação/normas fornecidas:
{docs_summary}

Responda em formato JSON puro (sem markdown), com a seguinte estrutura:
{{
  "procedimento": "{procedure_type}",
  "resumo": "Breve descrição do procedimento e seu embasamento legal",
  "documentos_necessarios": [
    {{
      "documento": "Nome do documento",
      "descricao": "Para que serve / onde obter",
      "embasamento": "Lei/norma que exige (ex: Art. X da Lei Y)",
      "obrigatorio": true,
      "prazo": "prazo para obtenção se houver"
    }}
  ],
  "taxas_e_custas": [
    {{
      "descricao": "Nome da taxa/custa",
      "base_legal": "Lei/decreto que estabelece",
      "observacao": "Como calcular ou onde pagar"
    }}
  ],
  "observacoes": ["observações importantes sobre o procedimento"],
  "legislacao_aplicavel": ["lista das leis/normas que embasam o procedimento"]
}}"""


@router.post("/consult-stream")
async def consult_legal_docs_stream(
    body: ConsultRequest,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    """Consulta IA com base nos documentos legislativos selecionados (streaming)."""
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Claude API não configurada.")
    if not body.doc_ids:
        raise HTTPException(status_code=400, detail="Selecione ao menos um documento legislativo.")

    result = await db.execute(
        sa.select(LegalDocument).where(
            LegalDocument.id.in_([UUID(did) for did in body.doc_ids]),
            LegalDocument.is_active == True,
        )
    )
    docs = result.scalars().all()
    if not docs:
        raise HTTPException(status_code=404, detail="Nenhum documento encontrado.")

    proc_label = PROCEDURE_TYPE_LABELS.get(body.procedure_type, body.procedure_type)
    municipio_info = f"Município: {body.municipio}" if body.municipio else ""
    context = f"Contexto adicional: {body.additional_context}" if body.additional_context else ""

    content_blocks: list[dict] = []

    docs_with_file = [d for d in docs if d.content_b64]
    docs_text_only = [d for d in docs if not d.content_b64]

    for doc in docs_with_file:
        media_type = doc.content_type or "application/pdf"
        if media_type == "application/pdf":
            content_blocks.append({
                "type": "document",
                "source": {"type": "base64", "media_type": "application/pdf", "data": doc.content_b64},
                "title": doc.name,
            })
        else:
            content_blocks.append({
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": doc.content_b64},
            })

    docs_summary_parts = []
    for doc in docs_text_only:
        parts = [f"- {doc.name} ({LEGAL_DOC_TYPE_LABELS.get(doc.doc_type, doc.doc_type)})"]
        if doc.numero:
            parts.append(f"  Número: {doc.numero}")
        if doc.descricao:
            parts.append(f"  Descrição: {doc.descricao}")
        if doc.summary:
            parts.append(f"  Resumo: {doc.summary}")
        docs_summary_parts.append("\n".join(parts))

    for doc in docs_with_file:
        parts = [f"- {doc.name} ({LEGAL_DOC_TYPE_LABELS.get(doc.doc_type, doc.doc_type)}) [arquivo incluído acima]"]
        if doc.numero:
            parts.append(f"  Número: {doc.numero}")
        docs_summary_parts.append("\n".join(parts))

    docs_summary = "\n\n".join(docs_summary_parts) or "(documentos em arquivo)"

    prompt_text = _CONSULT_PROMPT.format(
        procedure_type=proc_label,
        municipio_info=municipio_info,
        context=context,
        docs_summary=docs_summary,
    )
    content_blocks.append({"type": "text", "text": prompt_text})

    async def event_generator():
        try:
            async_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=180.0)
            async with async_client.messages.stream(
                model=settings.CLAUDE_MODEL,
                max_tokens=4096,
                messages=[{"role": "user", "content": content_blocks}],
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


@router.get("/procedure-types")
async def list_procedure_types(_: CurrentUser):
    return [{"value": k, "label": v} for k, v in PROCEDURE_TYPE_LABELS.items()]
