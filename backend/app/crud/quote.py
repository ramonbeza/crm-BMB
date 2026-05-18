from __future__ import annotations
import math
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client, ClientType
from app.models.procedure import PROCEDURE_TYPE_LABELS
from app.models.quote import (
    PAYMENT_MODEL_LABELS,
    QUOTE_STATUS_LABELS,
    Contract,
    PriceTableEntry,
    Quote,
)
from app.schemas.quote import (
    ContractCreate,
    ContractRead,
    ContractUpdate,
    CustaItem,
    InstallmentItem,
    PriceTableRead,
    PriceTableUpdate,
    QuoteCreate,
    QuoteRead,
    QuoteUpdate,
)

# Re-define for convenience (contract status labels not in model yet)
CONTRACT_STATUS_LABELS: dict[str, str] = {
    "rascunho": "Rascunho",
    "enviado": "Enviado",
    "aguardando_assinatura": "Aguardando assinatura",
    "assinado": "Assinado",
    "cancelado": "Cancelado",
}


# ── helpers ───────────────────────────────────────────────────────────────────

def _client_name(client: Client | None) -> str | None:
    if client is None:
        return None
    if client.client_type == ClientType.PF and client.pf_data:
        return client.pf_data.name
    if client.client_type == ClientType.PJ and client.pj_data:
        return client.pj_data.company_name
    return None


def _quote_formatted(year: int, number: int, version: int) -> str:
    base = f"BMB-ORC-{year}-{str(number).zfill(4)}"
    return f"{base}-v{version}" if version > 1 else base


def _contract_formatted(year: int, number: int) -> str:
    return f"BMB-CTR-{year}-{str(number).zfill(4)}"


def _custas_list(raw: list | None) -> list[CustaItem]:
    if not raw:
        return []
    return [CustaItem(name=c["name"], value=float(c["value"])) for c in raw]


def _quote_to_read(q: Quote) -> QuoteRead:
    custas = _custas_list(q.custas_estimadas)
    custas_total = sum(c.value for c in custas)
    subtotal = float(q.honorarios_escritorio or 0) + float(q.honorarios_despachante or 0) + custas_total
    total = max(0.0, subtotal - float(q.desconto or 0))
    return QuoteRead(
        id=q.id,
        quote_number=q.quote_number,
        quote_year=q.quote_year,
        version=q.version,
        formatted_number=_quote_formatted(q.quote_year, q.quote_number, q.version),
        procedure_id=q.procedure_id,
        client_id=q.client_id,
        client_name=_client_name(q.client),
        procedure_type=q.procedure_type,
        procedure_type_label=PROCEDURE_TYPE_LABELS.get(q.procedure_type, q.procedure_type) if q.procedure_type else None,
        status=q.status,
        status_label=QUOTE_STATUS_LABELS.get(q.status, q.status),
        honorarios_escritorio=float(q.honorarios_escritorio or 0),
        honorarios_despachante=float(q.honorarios_despachante or 0),
        custas_estimadas=custas,
        custas_total=custas_total,
        desconto=float(q.desconto or 0),
        desconto_motivo=q.desconto_motivo,
        subtotal=subtotal,
        total=total,
        valid_until=q.valid_until,
        notas=q.notas,
        sent_at=q.sent_at,
        signed_at=q.signed_at,
        created_by_id=q.created_by_id,
        parent_quote_id=q.parent_quote_id,
        created_at=q.created_at,
        updated_at=q.updated_at,
    )


def _contract_to_read(c: Contract) -> ContractRead:
    installments = [
        InstallmentItem(due_date=i["due_date"], value=float(i["value"]), status=i.get("status", "pendente"))
        for i in (c.installments or [])
    ]
    return ContractRead(
        id=c.id,
        contract_number=c.contract_number,
        contract_year=c.contract_year,
        formatted_number=_contract_formatted(c.contract_year, c.contract_number),
        quote_id=c.quote_id,
        procedure_id=c.procedure_id,
        client_id=c.client_id,
        client_name=_client_name(c.client),
        status=c.status,
        status_label=CONTRACT_STATUS_LABELS.get(c.status, c.status),
        payment_model=c.payment_model,
        payment_model_label=PAYMENT_MODEL_LABELS.get(c.payment_model, c.payment_model),
        total_value=float(c.total_value or 0),
        installments=installments,
        exito_percentual=float(c.exito_percentual) if c.exito_percentual is not None else None,
        signed_at=c.signed_at,
        notas=c.notas,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


# ── Quote CRUD ────────────────────────────────────────────────────────────────

async def _next_quote_number(db: AsyncSession) -> int:
    res = await db.execute(text("SELECT nextval('quote_number_seq')"))
    return int(res.scalar_one())


async def create_quote(db: AsyncSession, *, obj_in: QuoteCreate, created_by_id: UUID) -> QuoteRead:
    year = datetime.now(timezone.utc).year
    number = await _next_quote_number(db)
    q = Quote(
        quote_number=number,
        quote_year=year,
        version=1,
        client_id=obj_in.client_id,
        procedure_id=obj_in.procedure_id,
        procedure_type=obj_in.procedure_type,
        honorarios_escritorio=obj_in.honorarios_escritorio,
        honorarios_despachante=obj_in.honorarios_despachante,
        custas_estimadas=[c.model_dump() for c in obj_in.custas_estimadas],
        desconto=obj_in.desconto,
        desconto_motivo=obj_in.desconto_motivo,
        valid_until=obj_in.valid_until,
        notas=obj_in.notas,
        created_by_id=created_by_id,
    )
    db.add(q)
    await db.commit()
    fetched = await get_quote(db, q.id)
    return _quote_to_read(fetched)  # type: ignore[arg-type]


async def get_quote(db: AsyncSession, quote_id: UUID) -> Quote | None:
    res = await db.execute(
        select(Quote)
        .options(
            selectinload(Quote.client).selectinload(Client.pf_data),
            selectinload(Quote.client).selectinload(Client.pj_data),
        )
        .where(Quote.id == quote_id)
    )
    return res.scalar_one_or_none()


async def update_quote(db: AsyncSession, *, db_obj: Quote, obj_in: QuoteUpdate) -> QuoteRead:
    data = obj_in.model_dump(exclude_unset=True)
    if "custas_estimadas" in data and data["custas_estimadas"] is not None:
        data["custas_estimadas"] = [c.model_dump() for c in data["custas_estimadas"]]
    for field, value in data.items():
        setattr(db_obj, field, value)
    if obj_in.status == "enviado" and db_obj.sent_at is None:
        db_obj.sent_at = datetime.now(timezone.utc)
    if obj_in.status == "assinado" and db_obj.signed_at is None:
        db_obj.signed_at = datetime.now(timezone.utc)
    await db.commit()
    fetched = await get_quote(db, db_obj.id)
    return _quote_to_read(fetched)  # type: ignore[arg-type]


async def new_version(db: AsyncSession, *, original: Quote, created_by_id: UUID) -> QuoteRead:
    """Clone a quote bumping its version number."""
    new_q = Quote(
        quote_number=original.quote_number,
        quote_year=original.quote_year,
        version=original.version + 1,
        client_id=original.client_id,
        procedure_id=original.procedure_id,
        procedure_type=original.procedure_type,
        honorarios_escritorio=original.honorarios_escritorio,
        honorarios_despachante=original.honorarios_despachante,
        custas_estimadas=original.custas_estimadas,
        desconto=original.desconto,
        desconto_motivo=original.desconto_motivo,
        valid_until=original.valid_until,
        notas=original.notas,
        created_by_id=created_by_id,
        parent_quote_id=original.id,
        status="rascunho",
    )
    db.add(new_q)
    await db.commit()
    fetched = await get_quote(db, new_q.id)
    return _quote_to_read(fetched)  # type: ignore[arg-type]


async def list_quotes(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 20,
    client_id: UUID | None = None,
    procedure_id: UUID | None = None,
    status: str | None = None,
) -> dict:
    q = (
        select(Quote)
        .options(
            selectinload(Quote.client).selectinload(Client.pf_data),
            selectinload(Quote.client).selectinload(Client.pj_data),
        )
        .order_by(Quote.quote_year.desc(), Quote.quote_number.desc(), Quote.version.desc())
    )
    if client_id:
        q = q.where(Quote.client_id == client_id)
    if procedure_id:
        q = q.where(Quote.procedure_id == procedure_id)
    if status:
        q = q.where(Quote.status == status)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()

    items = []
    for row in rows:
        custas = _custas_list(row.custas_estimadas)
        custas_total = sum(c.value for c in custas)
        subtotal = float(row.honorarios_escritorio or 0) + float(row.honorarios_despachante or 0) + custas_total
        total_val = max(0.0, subtotal - float(row.desconto or 0))
        items.append({
            "id": row.id,
            "formatted_number": _quote_formatted(row.quote_year, row.quote_number, row.version),
            "version": row.version,
            "client_id": row.client_id,
            "client_name": _client_name(row.client),
            "procedure_id": row.procedure_id,
            "procedure_type_label": PROCEDURE_TYPE_LABELS.get(row.procedure_type, row.procedure_type) if row.procedure_type else None,
            "status": row.status,
            "status_label": QUOTE_STATUS_LABELS.get(row.status, row.status),
            "total": total_val,
            "valid_until": row.valid_until,
            "created_at": row.created_at,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, math.ceil(total / page_size)),
    }


# ── Contract CRUD ─────────────────────────────────────────────────────────────

async def _next_contract_number(db: AsyncSession) -> int:
    res = await db.execute(text("SELECT nextval('contract_number_seq')"))
    return int(res.scalar_one())


async def create_contract(db: AsyncSession, *, obj_in: ContractCreate, created_by_id: UUID) -> ContractRead:
    year = datetime.now(timezone.utc).year
    number = await _next_contract_number(db)
    c = Contract(
        contract_number=number,
        contract_year=year,
        quote_id=obj_in.quote_id,
        procedure_id=obj_in.procedure_id,
        client_id=obj_in.client_id,
        payment_model=obj_in.payment_model,
        total_value=obj_in.total_value,
        installments=[i.model_dump() for i in obj_in.installments],
        exito_percentual=obj_in.exito_percentual,
        notas=obj_in.notas,
        created_by_id=created_by_id,
    )
    db.add(c)
    await db.commit()
    fetched = await get_contract(db, c.id)
    return _contract_to_read(fetched)  # type: ignore[arg-type]


async def get_contract(db: AsyncSession, contract_id: UUID) -> Contract | None:
    res = await db.execute(
        select(Contract)
        .options(
            selectinload(Contract.client).selectinload(Client.pf_data),
            selectinload(Contract.client).selectinload(Client.pj_data),
        )
        .where(Contract.id == contract_id)
    )
    return res.scalar_one_or_none()


async def update_contract(db: AsyncSession, *, db_obj: Contract, obj_in: ContractUpdate) -> ContractRead:
    data = obj_in.model_dump(exclude_unset=True)
    if "installments" in data and data["installments"] is not None:
        data["installments"] = [i.model_dump() for i in data["installments"]]
    for field, value in data.items():
        setattr(db_obj, field, value)
    if obj_in.status == "assinado" and db_obj.signed_at is None:
        db_obj.signed_at = datetime.now(timezone.utc)
    await db.commit()
    fetched = await get_contract(db, db_obj.id)
    return _contract_to_read(fetched)  # type: ignore[arg-type]


async def list_contracts(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 20,
    client_id: UUID | None = None,
    status: str | None = None,
) -> dict:
    q = (
        select(Contract)
        .options(
            selectinload(Contract.client).selectinload(Client.pf_data),
            selectinload(Contract.client).selectinload(Client.pj_data),
        )
        .order_by(Contract.contract_year.desc(), Contract.contract_number.desc())
    )
    if client_id:
        q = q.where(Contract.client_id == client_id)
    if status:
        q = q.where(Contract.status == status)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()

    items = [{
        "id": r.id,
        "formatted_number": _contract_formatted(r.contract_year, r.contract_number),
        "client_id": r.client_id,
        "client_name": _client_name(r.client),
        "procedure_id": r.procedure_id,
        "status": r.status,
        "status_label": CONTRACT_STATUS_LABELS.get(r.status, r.status),
        "payment_model_label": PAYMENT_MODEL_LABELS.get(r.payment_model, r.payment_model),
        "total_value": float(r.total_value or 0),
        "created_at": r.created_at,
    } for r in rows]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, math.ceil(total / page_size)),
    }


# ── Price Table ───────────────────────────────────────────────────────────────

async def get_price_table(db: AsyncSession) -> list[PriceTableRead]:
    from app.models.procedure import PROCEDURE_TYPE_LABELS
    res = await db.execute(select(PriceTableEntry).order_by(PriceTableEntry.procedure_type))
    entries = res.scalars().all()
    return [
        PriceTableRead(
            id=e.id,
            procedure_type=e.procedure_type,
            procedure_type_label=PROCEDURE_TYPE_LABELS.get(e.procedure_type, e.procedure_type),
            base_honorarios=float(e.base_honorarios or 0),
            base_despachante=float(e.base_despachante or 0),
            custas_tipicas=_custas_list(e.custas_tipicas),
            notas=e.notas,
        )
        for e in entries
    ]


async def upsert_price_entry(
    db: AsyncSession, procedure_type: str, obj_in: PriceTableUpdate
) -> PriceTableRead:
    from app.models.procedure import PROCEDURE_TYPE_LABELS
    res = await db.execute(select(PriceTableEntry).where(PriceTableEntry.procedure_type == procedure_type))
    entry = res.scalar_one_or_none()
    if entry is None:
        entry = PriceTableEntry(procedure_type=procedure_type)
        db.add(entry)
    if obj_in.base_honorarios is not None:
        entry.base_honorarios = obj_in.base_honorarios
    if obj_in.base_despachante is not None:
        entry.base_despachante = obj_in.base_despachante
    if obj_in.custas_tipicas is not None:
        entry.custas_tipicas = [c.model_dump() for c in obj_in.custas_tipicas]
    if obj_in.notas is not None:
        entry.notas = obj_in.notas
    await db.flush()
    await db.commit()
    await db.refresh(entry)
    return PriceTableRead(
        id=entry.id,
        procedure_type=entry.procedure_type,
        procedure_type_label=PROCEDURE_TYPE_LABELS.get(entry.procedure_type, entry.procedure_type),
        base_honorarios=float(entry.base_honorarios or 0),
        base_despachante=float(entry.base_despachante or 0),
        custas_tipicas=_custas_list(entry.custas_tipicas),
        notas=entry.notas,
    )
