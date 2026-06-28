"""
Extração de documentos jurídicos com IA — certidões, plantas, memoriais, contratos, etc.
"""
from __future__ import annotations

import base64
import json
import re
from typing import Annotated
from uuid import UUID

import anthropic
import sqlalchemy as sa
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import CurrentUser, get_session
from app.models.document import ExtractedDocument

router = APIRouter()

# ── Prompt ────────────────────────────────────────────────────────────────────

_EXTRACT_DOC_PROMPT = """Você é um especialista em documentação imobiliária e cartorária brasileira.
Analise este documento e extraia as informações relevantes em formato JSON puro (sem markdown).

Primeiro identifique o tipo de documento e depois extraia todos os campos aplicáveis:

{
  "doc_type": "tipo_tecnico_sem_espaco",
  "doc_type_label": "Nome legível do tipo de documento",
  "resumo": "Resumo em 1-2 frases do conteúdo do documento",
  "data_emissao": "data de emissão (DD/MM/AAAA ou null)",
  "validade": "data de validade se houver (DD/MM/AAAA ou null)",
  "emitente": "órgão ou cartório emissor",
  "numero_documento": "número/protocolo/matrícula do documento se houver",
  "campos": {
    // Campos específicos conforme o tipo — veja exemplos abaixo
  },
  "partes": [
    {
      "papel": "ex: proprietário, outorgante, requerente, falecido, herdeiro, comprador, vendedor",
      "nome": "nome completo",
      "cpf_cnpj": "CPF ou CNPJ se constar",
      "qualificacao": "demais dados de qualificação se constarem"
    }
  ],
  "imovel": {
    "descricao": "descrição do imóvel se houver",
    "matricula": "número da matrícula se houver",
    "endereco": "endereço se houver",
    "area": "área se houver"
  },
  "valor": "valor monetário principal se houver (ex: R$ 500.000,00)",
  "alertas": ["lista de alertas: 'documento vencido', 'pendência fiscal', 'ônus registrado', 'ausência de ART', etc."],
  "observacoes": "demais observações relevantes"
}

Exemplos de doc_type e campos específicos:

certidao_matricula → campos: { "numero_matricula", "cartorio", "comarca", "situacao": "regular|com_onus|irregular", "onus": [] }
certidao_negativa_debitos → campos: { "tipo": "municipal|estadual|federal|inss|receita|trabalhista", "inscricao_consultada", "resultado": "negativa|positiva|positiva_com_efeito_negativo" }
certidao_obito → campos: { "falecido", "data_obito", "cartorio_registro", "numero_registro" }
certidao_casamento → campos: { "conjuge1", "conjuge2", "data_casamento", "regime_bens", "cartorio_registro" }
certidao_nascimento → campos: { "registrado", "data_nascimento", "filiacao", "cartorio_registro" }
planta_aprovada → campos: { "tipo_planta": "arquitetônica|topográfica|georreferenciada|implantação", "numero_aprovacao", "prefeitura", "engenheiro_responsavel", "art_rrt", "area_construida", "area_terreno" }
memorial_descritivo → campos: { "imovel_descrito", "area_total", "confrontantes": { "norte", "sul", "leste", "oeste" }, "coordenadas": "sim|nao", "engenheiro_responsavel", "art_rrt" }
contrato_compra_venda → campos: { "vendedor", "comprador", "valor", "forma_pagamento", "objeto", "data_assinatura", "prazo_entrega" }
contrato_honorarios → campos: { "contratante", "contratado", "servicos", "valor_total", "forma_pagamento", "vigencia" }
escritura_publica → campos: { "tipo_escritura", "tabeliao", "numero_livro", "numero_folha", "valor_declarado" }
habite_se → campos: { "numero", "municipio", "data_vistoria", "area_construida", "uso": "residencial|comercial|misto" }
auto_vistoria_cbm → campos: { "numero", "unidade_cbm", "validade_avcb", "tipo_uso", "area_total" }
procuracao → campos: { "outorgante", "outorgado", "poderes", "validade", "tabeliao", "numero_livro" }
alvara_construcao → campos: { "numero", "municipio", "validade", "area_autorizada", "uso" }
art_rrt → campos: { "numero_art_rrt", "tipo": "ART|RRT", "responsavel_tecnico", "conselho", "obra_servico", "valor_obra" }
ccir → campos: { "numero_ccir", "imovel_rural", "municipio_uf", "area_total_ha", "situacao_fiscal" }
itr → campos: { "exercicio", "nirf", "valor_imposto", "situacao": "quitado|em_aberto" }
formal_partilha → campos: { "inventariante", "herdeiros": [], "bens_partilhados": [], "valor_total_inventario", "juizo_cartorio" }
convenio_condominio → campos: { "nome_condominio", "numero_unidades", "fracao_solo", "administracao" }
laudo_avaliacao → campos: { "avaliador", "crea_creci", "valor_avaliado", "metodo_avaliacao", "data_avaliacao" }

Se o documento não se encaixar em nenhum tipo acima, use:
outros → { "descricao_tipo": "descrição livre do que é o documento" }

Regras:
- Extraia TODOS os dados visíveis, mesmo que parcialmente legíveis
- Se um campo não constar, use null
- alertas só para situações realmente importantes (vencimento, pendência, ônus)
- Retorne APENAS o JSON, sem explicações"""


# ── Schemas ───────────────────────────────────────────────────────────────────

class ExtractedDocRead(BaseModel):
    id: str
    procedure_id: str | None
    property_id: str | None
    filename: str
    doc_type: str | None
    doc_type_label: str | None
    extracted_data: dict | None
    status: str
    error_message: str | None
    created_at: str

    @classmethod
    def from_orm(cls, d: ExtractedDocument) -> "ExtractedDocRead":
        return cls(
            id=str(d.id),
            procedure_id=str(d.procedure_id) if d.procedure_id else None,
            property_id=str(d.property_id) if d.property_id else None,
            filename=d.filename,
            doc_type=d.doc_type,
            doc_type_label=d.doc_type_label,
            extracted_data=d.extracted_data,
            status=d.status,
            error_message=d.error_message,
            created_at=d.created_at.isoformat(),
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/extract", summary="Extrai dados de documentos jurídicos com IA")
async def extract_documents(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    files: list[UploadFile] = File(...),
    procedure_id: UUID | None = Query(None),
    property_id: UUID | None = Query(None),
) -> list[ExtractedDocRead]:
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Claude API não configurada.")
    if not files:
        raise HTTPException(status_code=400, detail="Envie ao menos um arquivo.")
    if not procedure_id and not property_id:
        raise HTTPException(status_code=400, detail="Informe procedure_id ou property_id.")

    allowed = {"application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"}
    results: list[ExtractedDocRead] = []
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=120.0)

    for file in files:
        content_type = (file.content_type or "").split(";")[0].strip()
        if content_type not in allowed:
            doc = ExtractedDocument(
                procedure_id=procedure_id,
                property_id=property_id,
                filename=file.filename or "desconhecido",
                content_type=content_type,
                status="erro",
                error_message=f"Formato não suportado: {content_type}",
            )
            db.add(doc)
            await db.flush()
            results.append(ExtractedDocRead.from_orm(doc))
            continue

        data = await file.read()
        if len(data) > 20 * 1024 * 1024:
            doc = ExtractedDocument(
                procedure_id=procedure_id,
                property_id=property_id,
                filename=file.filename or "desconhecido",
                content_type=content_type,
                status="erro",
                error_message="Arquivo muito grande (máx 20 MB).",
            )
            db.add(doc)
            await db.flush()
            results.append(ExtractedDocRead.from_orm(doc))
            continue

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

        try:
            message = client.messages.create(
                model=settings.CLAUDE_MODEL,
                max_tokens=4096,
                messages=[{
                    "role": "user",
                    "content": [source_block, {"type": "text", "text": _EXTRACT_DOC_PROMPT}],
                }],
            )
            raw = message.content[0].text.strip()
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
            extracted = json.loads(raw)

            doc = ExtractedDocument(
                procedure_id=procedure_id,
                property_id=property_id,
                filename=file.filename or "desconhecido",
                content_type=content_type,
                doc_type=extracted.get("doc_type"),
                doc_type_label=extracted.get("doc_type_label"),
                extracted_data=extracted,
                status="extraido",
            )
        except Exception as exc:
            doc = ExtractedDocument(
                procedure_id=procedure_id,
                property_id=property_id,
                filename=file.filename or "desconhecido",
                content_type=content_type,
                status="erro",
                error_message=str(exc)[:500],
            )

        db.add(doc)
        await db.flush()
        results.append(ExtractedDocRead.from_orm(doc))

    await db.commit()
    return results


@router.get("", summary="Lista documentos extraídos")
async def list_documents(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    procedure_id: UUID | None = Query(None),
    property_id: UUID | None = Query(None),
) -> list[ExtractedDocRead]:
    q = sa.select(ExtractedDocument).order_by(ExtractedDocument.created_at.desc())
    if procedure_id:
        q = q.where(ExtractedDocument.procedure_id == procedure_id)
    elif property_id:
        q = q.where(ExtractedDocument.property_id == property_id)
    else:
        raise HTTPException(status_code=400, detail="Informe procedure_id ou property_id.")
    docs = (await db.execute(q)).scalars().all()
    return [ExtractedDocRead.from_orm(d) for d in docs]


@router.delete("/{doc_id}", status_code=204, summary="Remove documento extraído")
async def delete_document(
    doc_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    doc = (await db.execute(sa.select(ExtractedDocument).where(ExtractedDocument.id == doc_id))).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    await db.delete(doc)
    await db.commit()
    return Response(status_code=204)
