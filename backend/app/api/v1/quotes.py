from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, get_session
from app.core.pdf_gen import generate_contract_pdf, generate_quote_pdf
from app.crud.quote import (
    _contract_to_read,
    _quote_to_read,
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


# ── Quotes — listagem e criação ───────────────────────────────────────────────

@router.get("", response_model=PaginatedQuotes)
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


@router.post("", response_model=QuoteRead, status_code=status.HTTP_201_CREATED)
async def create_quote_ep(
    body: QuoteCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await create_quote(db, obj_in=body, created_by_id=current_user.id)


# ── Contracts — ANTES das rotas dinâmicas /{quote_id} ────────────────────────

@router.get("/contratos", response_model=PaginatedContracts)
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


@router.post("/contratos", response_model=ContractRead, status_code=status.HTTP_201_CREATED)
async def create_contract_ep(
    body: ContractCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    return await create_contract(db, obj_in=body, created_by_id=current_user.id)


@router.get("/contratos/{contract_id}/pdf", summary="Baixar contrato em PDF")
async def download_contract_pdf(
    contract_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    c_orm = await get_contract(db, contract_id)
    if not c_orm:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    c = _contract_to_read(c_orm)

    pdf_bytes = generate_contract_pdf(
        formatted_number=c.formatted_number,
        client_name=c.client_name or "—",
        payment_model_label=c.payment_model_label,
        total_value=float(c.total_value),
        installments=[
            {"due_date": inst.due_date, "value": float(inst.value), "status": inst.status}
            for inst in c.installments
        ],
        exito_percentual=float(c.exito_percentual) if c.exito_percentual else None,
        notas=c.notas,
        status_label=c.status_label,
        quote_number=None,
    )
    filename = f"{c.formatted_number.replace('/', '-')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/contratos/{contract_id}", response_model=ContractRead)
async def get_contract_ep(
    contract_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    c = await get_contract(db, contract_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
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


# ── Price table — ANTES das rotas dinâmicas /{quote_id} ──────────────────────

@router.get("/tabela-precos", response_model=list[PriceTableRead])
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


# ── Quote PDF — ANTES de /{quote_id} ─────────────────────────────────────────

@router.get("/{quote_id}/pdf", summary="Baixar orçamento em PDF")
async def download_quote_pdf(
    quote_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    q_orm = await get_quote(db, quote_id)
    if not q_orm:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    q = _quote_to_read(q_orm)

    pdf_bytes = generate_quote_pdf(
        formatted_number=q.formatted_number,
        client_name=q.client_name or "—",
        procedure_type_label=q.procedure_type_label,
        honorarios_escritorio=float(q.honorarios_escritorio),
        honorarios_despachante=float(q.honorarios_despachante),
        custas_list=[{"name": c.name, "value": float(c.value)} for c in q.custas_estimadas],
        desconto=float(q.desconto),
        desconto_motivo=q.desconto_motivo,
        total=float(q.total),
        valid_until=q.valid_until,
        notas=q.notas,
        status_label=q.status_label,
    )
    filename = f"{q.formatted_number.replace('/', '-')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Quote CRUD dinâmico — DEPOIS de todos os paths fixos ─────────────────────

@router.get("/{quote_id}", response_model=QuoteRead)
async def get_quote_ep(
    quote_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    q = await get_quote(db, quote_id)
    if not q:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
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
