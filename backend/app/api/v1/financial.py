"""
Rotas — Módulo 8 Financeiro
"""
from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, get_session
from app.crud import financial as crud
from app.schemas.financial import (
    FinancialDashboard,
    FinancialEntryCreate,
    FinancialEntryRead,
    FinancialEntryUpdate,
    PaginatedFinancialEntries,
    ProcedureFinancialSummary,
)

router = APIRouter()


# ── Dashboard global ──────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=FinancialDashboard)
async def get_dashboard(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await crud.financial_dashboard(db)


# ── Resumo por procedimento ───────────────────────────────────────────────────

@router.get("/procedure/{procedure_id}", response_model=ProcedureFinancialSummary)
async def get_procedure_summary(
    procedure_id: uuid.UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await crud.procedure_financial_summary(db, procedure_id)


# ── CRUD de entradas ──────────────────────────────────────────────────────────

@router.get("/", response_model=PaginatedFinancialEntries)
async def list_entries(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    tipo: Optional[str] = None,
    status: Optional[str] = None,
    procedure_id: Optional[uuid.UUID] = None,
    contract_id: Optional[uuid.UUID] = None,
    client_id: Optional[uuid.UUID] = None,
):
    return await crud.list_financial_entries(
        db,
        page=page,
        page_size=page_size,
        tipo=tipo,
        status=status,
        procedure_id=procedure_id,
        contract_id=contract_id,
        client_id=client_id,
    )


@router.post("/", response_model=FinancialEntryRead, status_code=201)
async def create_entry(
    body: FinancialEntryCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await crud.create_financial_entry(db, obj_in=body, created_by_id=current_user.id)


@router.get("/{entry_id}", response_model=FinancialEntryRead)
async def get_entry(
    entry_id: uuid.UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    entry = await crud.get_financial_entry(db, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    return entry


@router.put("/{entry_id}", response_model=FinancialEntryRead)
async def update_entry(
    entry_id: uuid.UUID,
    body: FinancialEntryUpdate,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    entry = await crud.update_financial_entry(db, entry_id, body)
    if not entry:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    return entry


@router.post("/{entry_id}/pagar", response_model=FinancialEntryRead)
async def mark_paid(
    entry_id: uuid.UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    """Marca um lançamento como pago (paid_at = agora)."""
    entry = await crud.mark_paid(db, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    return entry


@router.delete("/{entry_id}", status_code=204)
async def cancel_entry(
    entry_id: uuid.UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    """Cancela (soft-delete) um lançamento financeiro."""
    ok = await crud.delete_financial_entry(db, entry_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
