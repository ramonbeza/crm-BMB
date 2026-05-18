from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, get_session
from app.crud.quote import (
    create_contract,
    create_quote,
    get_contract,
    get_price_table,
    get_quote,
    list_contracts,
    list_quotes,
    new_version,
    update_contract,
    update_quote,
    upsert_price_entry,
)
from app.schemas.quote import (
    ContractCreate,
    ContractRead,
    ContractUpdate,
    PaginatedContracts,
    PaginatedQuotes,
    PriceTableRead,
    PriceTableUpdate,
    QuoteCreate,
    QuoteRead,
    QuoteUpdate,
)

router = APIRouter()


# ── Quotes ────────────────────────────────────────────────────────────────────

@router.get("/", response_model=PaginatedQuotes)
async def list_quotes_ep(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    client_id: UUID | None = Query(None),
    procedure_id: UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
):
    return await list_quotes(
        db, page=page, page_size=page_size,
        client_id=client_id, procedure_id=procedure_id, status=status_filter,
    )


@router.post("/", response_model=QuoteRead, status_code=status.HTTP_201_CREATED)
async def create_quote_ep(
    body: QuoteCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await create_quote(db, obj_in=body, created_by_id=current_user.id)


@router.get("/{quote_id}", response_model=QuoteRead)
async def get_quote_ep(
    quote_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    q = await get_quote(db, quote_id)
    if not q:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    from app.crud.quote import _quote_to_read
    return _quote_to_read(q)


@router.put("/{quote_id}", response_model=QuoteRead)
async def update_quote_ep(
    quote_id: UUID,
    body: QuoteUpdate,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    q = await get_quote(db, quote_id)
    if not q:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return await update_quote(db, db_obj=q, obj_in=body)


@router.post("/{quote_id}/nova-versao", response_model=QuoteRead, status_code=status.HTTP_201_CREATED)
async def new_version_ep(
    quote_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    q = await get_quote(db, quote_id)
    if not q:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return await new_version(db, original=q, created_by_id=current_user.id)


# ── Contracts ─────────────────────────────────────────────────────────────────

@router.get("/contratos/", response_model=PaginatedContracts)
async def list_contracts_ep(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    client_id: UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
):
    return await list_contracts(
        db, page=page, page_size=page_size,
        client_id=client_id, status=status_filter,
    )


@router.post("/contratos/", response_model=ContractRead, status_code=status.HTTP_201_CREATED)
async def create_contract_ep(
    body: ContractCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await create_contract(db, obj_in=body, created_by_id=current_user.id)


@router.get("/contratos/{contract_id}", response_model=ContractRead)
async def get_contract_ep(
    contract_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    c = await get_contract(db, contract_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    from app.crud.quote import _contract_to_read
    return _contract_to_read(c)


@router.put("/contratos/{contract_id}", response_model=ContractRead)
async def update_contract_ep(
    contract_id: UUID,
    body: ContractUpdate,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    c = await get_contract(db, contract_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    return await update_contract(db, db_obj=c, obj_in=body)


# ── Price table ───────────────────────────────────────────────────────────────

@router.get("/tabela-precos/", response_model=list[PriceTableRead])
async def get_price_table_ep(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await get_price_table(db)


@router.put("/tabela-precos/{procedure_type}", response_model=PriceTableRead)
async def upsert_price_ep(
    procedure_type: str,
    body: PriceTableUpdate,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await upsert_price_entry(db, procedure_type=procedure_type, obj_in=body)
