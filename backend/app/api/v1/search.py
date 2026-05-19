"""
Sprint 16 — Busca Global
GET /api/v1/search?q=<term>&limit=5
Pesquisa clientes, procedimentos e imóveis em uma única chamada.
Despachante-externo: vê apenas seus próprios procedimentos.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import cast, func, or_, select
from sqlalchemy.dialects.postgresql import TEXT
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, get_session, is_despachante
from app.models.client import Client, ClientPF, ClientPJ
from app.models.procedure import PROCEDURE_TYPE_LABELS, Procedure
from app.models.property import Property

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class ClientResult(BaseModel):
    id: uuid.UUID
    client_type: str
    name: str       # PF: name  /  PJ: company_name
    document: str   # CPF ou CNPJ
    phone: str
    email: str | None = None

    model_config = {"from_attributes": True}


class ProcedureResult(BaseModel):
    id: uuid.UUID
    protocol_number: int
    protocol_label: str          # BMB-AAAA-0001
    procedure_type: str
    procedure_type_label: str
    client_name: str
    status: str

    model_config = {"from_attributes": True}


class PropertyResult(BaseModel):
    id: uuid.UUID
    endereco: str | None = None
    matricula: str | None = None
    property_type: str

    model_config = {"from_attributes": True}


class SearchResponse(BaseModel):
    clients: list[ClientResult]
    procedures: list[ProcedureResult]
    properties: list[PropertyResult]
    total: int


# ── Helpers ────────────────────────────────────────────────────────────────────

def _ilike(column, term: str):
    return cast(column, TEXT).ilike(f"%{term}%")


def _protocol_label(proc: Procedure) -> str:
    year = proc.opened_at.year if proc.opened_at else 0
    return f"BMB-{year}-{proc.protocol_number:04d}"


def _client_name(proc: Procedure) -> str:
    c = proc.client
    if c is None:
        return ""
    if c.pf_data:
        return c.pf_data.name
    if c.pj_data:
        return c.pj_data.company_name
    return ""


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.get("/", response_model=SearchResponse)
async def global_search(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    q: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(5, ge=1, le=20),
) -> SearchResponse:
    """
    Busca unificada. Retorna até `limit` resultados por categoria.
    Despachante-externo vê apenas seus procedimentos; não vê clientes nem imóveis.
    """
    term = q.strip()

    clients_out: list[ClientResult] = []
    properties_out: list[PropertyResult] = []
    procedures_out: list[ProcedureResult] = []

    despachante = is_despachante(current_user)

    # ── Clientes (somente internos) ────────────────────────────────────────────
    if not despachante:
        # PF
        stmt_pf = (
            select(Client, ClientPF)
            .join(ClientPF, ClientPF.client_id == Client.id)
            .where(
                Client.is_active.is_(True),
                or_(
                    _ilike(ClientPF.name, term),
                    _ilike(ClientPF.cpf, term),
                    _ilike(Client.phone, term),
                    _ilike(Client.email, term),
                ),
            )
            .order_by(ClientPF.name)
            .limit(limit)
        )
        rows_pf = (await db.execute(stmt_pf)).all()
        for client, pf in rows_pf:
            clients_out.append(ClientResult(
                id=client.id,
                client_type="PF",
                name=pf.name,
                document=pf.cpf,
                phone=client.phone,
                email=client.email,
            ))

        # PJ
        remaining = limit - len(clients_out)
        if remaining > 0:
            stmt_pj = (
                select(Client, ClientPJ)
                .join(ClientPJ, ClientPJ.client_id == Client.id)
                .where(
                    Client.is_active.is_(True),
                    or_(
                        _ilike(ClientPJ.company_name, term),
                        _ilike(ClientPJ.cnpj, term),
                        _ilike(Client.phone, term),
                        _ilike(Client.email, term),
                    ),
                )
                .order_by(ClientPJ.company_name)
                .limit(remaining)
            )
            rows_pj = (await db.execute(stmt_pj)).all()
            for client, pj in rows_pj:
                clients_out.append(ClientResult(
                    id=client.id,
                    client_type="PJ",
                    name=pj.company_name,
                    document=pj.cnpj,
                    phone=client.phone,
                    email=client.email,
                ))

    # ── Procedimentos ──────────────────────────────────────────────────────────
    stmt_proc = (
        select(Procedure)
        .options(
            selectinload(Procedure.client).selectinload(Client.pf_data),
            selectinload(Procedure.client).selectinload(Client.pj_data),
        )
        .where(
            or_(
                _ilike(Procedure.requerente, term),
                _ilike(Procedure.description, term),
                _ilike(Procedure.matricula, term),
                # protocol_number como string: "0042" ou parte do label
                cast(Procedure.protocol_number, TEXT).ilike(f"%{term}%"),
            )
        )
        .order_by(Procedure.protocol_number.desc())
        .limit(limit)
    )
    if despachante:
        stmt_proc = stmt_proc.where(Procedure.executor_user_id == current_user.id)

    procs = (await db.execute(stmt_proc)).scalars().all()
    for p in procs:
        procedures_out.append(ProcedureResult(
            id=p.id,
            protocol_number=p.protocol_number,
            protocol_label=_protocol_label(p),
            procedure_type=p.procedure_type,
            procedure_type_label=PROCEDURE_TYPE_LABELS.get(p.procedure_type, p.procedure_type),
            client_name=_client_name(p),
            status=p.status,
        ))

    # ── Imóveis (somente internos) ─────────────────────────────────────────────
    if not despachante:
        stmt_prop = (
            select(Property)
            .where(
                Property.is_active.is_(True),
                or_(
                    _ilike(Property.endereco, term),
                    _ilike(Property.matricula, term),
                    _ilike(Property.incra_code, term),
                    _ilike(Property.inscricao_imobiliaria, term),
                ),
            )
            .order_by(Property.endereco)
            .limit(limit)
        )
        props = (await db.execute(stmt_prop)).scalars().all()
        for prop in props:
            properties_out.append(PropertyResult(
                id=prop.id,
                endereco=prop.endereco,
                matricula=prop.matricula,
                property_type=prop.property_type,
            ))

    total = len(clients_out) + len(procedures_out) + len(properties_out)
    return SearchResponse(
        clients=clients_out,
        procedures=procedures_out,
        properties=properties_out,
        total=total,
    )
