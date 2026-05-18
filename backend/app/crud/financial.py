"""
CRUD — Módulo 8 Financeiro
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.financial import (
    ENTRY_CATEGORY_LABELS,
    ENTRY_STATUS_LABELS,
    ENTRY_TIPO_LABELS,
    FinancialEntry,
)
from app.models.quote import Contract
from app.models.procedure import Procedure
from app.models.client import Client
from app.schemas.financial import (
    FinancialDashboard,
    FinancialEntryCreate,
    FinancialEntryListItem,
    FinancialEntryRead,
    FinancialEntryUpdate,
    PaginatedFinancialEntries,
    ProcedureFinancialSummary,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _repasse_formatted(year: int, number: int) -> str:
    return f"BMB-REP-{year}-{str(number).zfill(4)}"


def _to_list_item(e: FinancialEntry, client_name: str | None, procedure_number: str | None, contract_number: str | None) -> FinancialEntryListItem:
    return FinancialEntryListItem(
        id=e.id,
        formatted_number=(
            _repasse_formatted(e.entry_year, e.entry_number)
            if e.tipo == "repasse_despachante" and e.entry_number and e.entry_year
            else None
        ),
        tipo=e.tipo,
        tipo_label=ENTRY_TIPO_LABELS.get(e.tipo, e.tipo),
        category=e.category,
        category_label=ENTRY_CATEGORY_LABELS.get(e.category, e.category),
        description=e.description,
        value=e.value,
        status=e.status,
        status_label=ENTRY_STATUS_LABELS.get(e.status, e.status),
        due_date=e.due_date,
        paid_at=e.paid_at,
        procedure_id=e.procedure_id,
        procedure_number=procedure_number,
        contract_id=e.contract_id,
        client_id=e.client_id,
        client_name=client_name,
        created_at=e.created_at,
    )


async def _fetch_entry(db: AsyncSession, entry_id: uuid.UUID) -> FinancialEntry | None:
    result = await db.execute(
        sa.select(FinancialEntry)
        .where(FinancialEntry.id == entry_id)
        .options(
            selectinload(FinancialEntry.procedure),
            selectinload(FinancialEntry.contract),
            selectinload(FinancialEntry.created_by),
        )
    )
    return result.scalar_one_or_none()


async def _client_name(db: AsyncSession, client_id: uuid.UUID | None) -> str | None:
    if not client_id:
        return None
    from app.models.client import ClientPF, ClientPJ
    row = await db.execute(
        sa.select(ClientPF.name).where(ClientPF.client_id == client_id)
    )
    pf = row.scalar_one_or_none()
    if pf:
        return pf
    row2 = await db.execute(
        sa.select(ClientPJ.company_name).where(ClientPJ.client_id == client_id)
    )
    return row2.scalar_one_or_none()


def _entry_to_read(e: FinancialEntry, client_name: str | None = None) -> FinancialEntryRead:
    procedure_number: str | None = None
    contract_number_str: str | None = None

    if e.procedure:
        p = e.procedure
        procedure_number = f"BMB-{p.year}-{str(p.protocol_number).zfill(4)}"

    if e.contract:
        c = e.contract
        contract_number_str = f"BMB-CTR-{c.contract_year}-{str(c.contract_number).zfill(4)}"

    return FinancialEntryRead(
        id=e.id,
        entry_number=e.entry_number,
        entry_year=e.entry_year,
        formatted_number=(
            _repasse_formatted(e.entry_year, e.entry_number)
            if e.tipo == "repasse_despachante" and e.entry_number and e.entry_year
            else None
        ),
        procedure_id=e.procedure_id,
        procedure_number=procedure_number,
        contract_id=e.contract_id,
        contract_number=contract_number_str,
        client_id=e.client_id,
        client_name=client_name,
        tipo=e.tipo,
        tipo_label=ENTRY_TIPO_LABELS.get(e.tipo, e.tipo),
        category=e.category,
        category_label=ENTRY_CATEGORY_LABELS.get(e.category, e.category),
        description=e.description,
        value=e.value,
        status=e.status,
        status_label=ENTRY_STATUS_LABELS.get(e.status, e.status),
        due_date=e.due_date,
        paid_at=e.paid_at,
        notas=e.notas,
        created_by_id=e.created_by_id,
        created_at=e.created_at,
        updated_at=e.updated_at,
    )


# ── CRUD principal ────────────────────────────────────────────────────────────

async def create_financial_entry(
    db: AsyncSession,
    *,
    obj_in: FinancialEntryCreate,
    created_by_id: uuid.UUID,
) -> FinancialEntryRead:
    now = datetime.now(timezone.utc)
    year = now.year

    # Gerar número sequencial para repasses
    entry_number: int | None = None
    entry_year: int | None = None
    if obj_in.tipo == "repasse_despachante":
        row = await db.execute(sa.text("SELECT nextval('repasse_number_seq')"))
        entry_number = row.scalar_one()
        entry_year = year

    entry = FinancialEntry(
        entry_number=entry_number,
        entry_year=entry_year,
        procedure_id=obj_in.procedure_id,
        contract_id=obj_in.contract_id,
        client_id=obj_in.client_id,
        tipo=obj_in.tipo,
        category=obj_in.category,
        description=obj_in.description,
        value=obj_in.value,
        status=obj_in.status,
        due_date=obj_in.due_date,
        paid_at=obj_in.paid_at,
        notas=obj_in.notas,
        created_by_id=created_by_id,
    )
    db.add(entry)
    await db.commit()

    # Re-fetch com relacionamentos
    fetched = await _fetch_entry(db, entry.id)
    client_name = await _client_name(db, fetched.client_id if fetched else None)
    return _entry_to_read(fetched, client_name)


async def get_financial_entry(db: AsyncSession, entry_id: uuid.UUID) -> FinancialEntryRead | None:
    e = await _fetch_entry(db, entry_id)
    if not e:
        return None
    client_name = await _client_name(db, e.client_id)
    return _entry_to_read(e, client_name)


async def update_financial_entry(
    db: AsyncSession,
    entry_id: uuid.UUID,
    obj_in: FinancialEntryUpdate,
) -> FinancialEntryRead | None:
    e = await _fetch_entry(db, entry_id)
    if not e:
        return None

    data = obj_in.model_dump(exclude_unset=True)
    for field, val in data.items():
        setattr(e, field, val)

    await db.commit()
    fetched = await _fetch_entry(db, entry_id)
    client_name = await _client_name(db, fetched.client_id if fetched else None)
    return _entry_to_read(fetched, client_name)


async def mark_paid(
    db: AsyncSession,
    entry_id: uuid.UUID,
    paid_at: datetime | None = None,
) -> FinancialEntryRead | None:
    """Atalho para marcar uma entrada como paga."""
    return await update_financial_entry(
        db,
        entry_id,
        FinancialEntryUpdate(
            status="pago",
            paid_at=paid_at or datetime.now(timezone.utc),
        ),
    )


async def delete_financial_entry(db: AsyncSession, entry_id: uuid.UUID) -> bool:
    """Soft-delete: muda status para cancelado."""
    e = await _fetch_entry(db, entry_id)
    if not e:
        return False
    e.status = "cancelado"
    await db.commit()
    return True


async def list_financial_entries(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 25,
    tipo: Optional[str] = None,
    status: Optional[str] = None,
    procedure_id: Optional[uuid.UUID] = None,
    contract_id: Optional[uuid.UUID] = None,
    client_id: Optional[uuid.UUID] = None,
) -> PaginatedFinancialEntries:
    base = sa.select(FinancialEntry)

    if tipo:
        base = base.where(FinancialEntry.tipo == tipo)
    if status:
        base = base.where(FinancialEntry.status == status)
    if procedure_id:
        base = base.where(FinancialEntry.procedure_id == procedure_id)
    if contract_id:
        base = base.where(FinancialEntry.contract_id == contract_id)
    if client_id:
        base = base.where(FinancialEntry.client_id == client_id)

    count_q = sa.select(sa.func.count()).select_from(base.subquery())
    total: int = (await db.execute(count_q)).scalar_one()

    rows = (
        await db.execute(
            base.order_by(FinancialEntry.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .options(
                selectinload(FinancialEntry.procedure),
                selectinload(FinancialEntry.contract),
            )
        )
    ).scalars().all()

    items: list[FinancialEntryListItem] = []
    for e in rows:
        client_name = await _client_name(db, e.client_id)
        proc_num: str | None = None
        if e.procedure:
            p = e.procedure
            proc_num = f"BMB-{p.year}-{str(p.protocol_number).zfill(4)}"
        cont_num: str | None = None
        if e.contract:
            c = e.contract
            cont_num = f"BMB-CTR-{c.contract_year}-{str(c.contract_number).zfill(4)}"
        items.append(_to_list_item(e, client_name, proc_num, cont_num))

    return PaginatedFinancialEntries(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)),
    )


# ── Resumo financeiro por procedimento ───────────────────────────────────────

async def procedure_financial_summary(
    db: AsyncSession,
    procedure_id: uuid.UUID,
) -> ProcedureFinancialSummary:
    from app.models.quote import Quote, Contract

    zero = Decimal("0.00")

    # Buscar orçamento mais recente assinado ligado ao procedimento
    q_row = await db.execute(
        sa.select(Quote)
        .where(Quote.procedure_id == procedure_id, Quote.status == "assinado")
        .order_by(Quote.version.desc())
        .limit(1)
    )
    quote = q_row.scalar_one_or_none()

    hon_esc_orc = Decimal(str(quote.honorarios_escritorio)) if quote else zero
    hon_dep_orc = Decimal(str(quote.honorarios_despachante)) if quote else zero
    custas_est_total = zero
    if quote and quote.custas_estimadas:
        custas_est_total = sum(
            Decimal(str(c.get("value", 0))) for c in quote.custas_estimadas
        )
    total_orcado = hon_esc_orc + hon_dep_orc + custas_est_total

    # Buscar contrato assinado
    c_row = await db.execute(
        sa.select(Contract)
        .where(Contract.procedure_id == procedure_id, Contract.status == "assinado")
        .order_by(Contract.created_at.desc())
        .limit(1)
    )
    contract = c_row.scalar_one_or_none()

    total_contrato = Decimal(str(contract.total_value)) if contract else zero
    parcelas_pagas = zero
    parcelas_pendentes = zero
    if contract and contract.installments:
        for inst in contract.installments:
            v = Decimal(str(inst.get("value", 0)))
            if inst.get("status") == "pago":
                parcelas_pagas += v
            else:
                parcelas_pendentes += v

    # Buscar financial_entries do procedimento
    entries_rows = await db.execute(
        sa.select(FinancialEntry).where(
            FinancialEntry.procedure_id == procedure_id,
            FinancialEntry.status != "cancelado",
        )
    )
    entries = entries_rows.scalars().all()

    custas_reais_pagas = zero
    custas_reais_pendentes = zero
    repasses_pagos = zero
    repasses_pendentes = zero
    honorarios_recebidos = zero

    for e in entries:
        v = Decimal(str(e.value))
        if e.tipo == "custa_real":
            if e.status == "pago":
                custas_reais_pagas += v
            else:
                custas_reais_pendentes += v
        elif e.tipo == "repasse_despachante":
            if e.status == "pago":
                repasses_pagos += v
            else:
                repasses_pendentes += v
        elif e.tipo == "honorario_recebido":
            honorarios_recebidos += v

    variacao_custas = (custas_reais_pagas + custas_reais_pendentes) - custas_est_total

    return ProcedureFinancialSummary(
        procedure_id=procedure_id,
        quote_id=quote.id if quote else None,
        honorarios_escritorio_orcado=hon_esc_orc,
        honorarios_despachante_orcado=hon_dep_orc,
        custas_estimadas_total=custas_est_total,
        total_orcado=total_orcado,
        custas_reais_pagas=custas_reais_pagas,
        custas_reais_pendentes=custas_reais_pendentes,
        repasses_pagos=repasses_pagos,
        repasses_pendentes=repasses_pendentes,
        honorarios_recebidos=honorarios_recebidos,
        contract_id=contract.id if contract else None,
        total_contrato=total_contrato,
        parcelas_pagas=parcelas_pagas,
        parcelas_pendentes=parcelas_pendentes,
        variacao_custas=variacao_custas,
    )


# ── Dashboard global ──────────────────────────────────────────────────────────

async def financial_dashboard(db: AsyncSession) -> FinancialDashboard:
    from app.models.quote import Contract

    zero = Decimal("0.00")
    now = datetime.now(timezone.utc)
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    seven_days = now.date() + timedelta(days=7)

    # ── Parcelas de contratos ─────────────────────────────────────────────────
    contracts_row = await db.execute(
        sa.select(Contract).where(Contract.status == "assinado")
    )
    contracts = contracts_row.scalars().all()

    hon_a_receber = zero
    hon_recebidos_mes = zero
    for c in contracts:
        for inst in (c.installments or []):
            v = Decimal(str(inst.get("value", 0)))
            if inst.get("status") == "pendente":
                hon_a_receber += v
            elif inst.get("status") == "pago":
                paid_str = inst.get("paid_at")
                if paid_str:
                    try:
                        paid_dt = datetime.fromisoformat(paid_str)
                        if paid_dt.replace(tzinfo=timezone.utc) >= first_of_month:
                            hon_recebidos_mes += v
                    except Exception:
                        pass

    # ── Financial entries ─────────────────────────────────────────────────────
    all_entries_row = await db.execute(
        sa.select(FinancialEntry).where(FinancialEntry.status != "cancelado")
    )
    all_entries = all_entries_row.scalars().all()

    custas_pendentes = zero
    custas_pagas_mes = zero
    repasses_pendentes = zero
    repasses_pagos_mes = zero

    for e in all_entries:
        v = Decimal(str(e.value))
        if e.tipo == "custa_real":
            if e.status == "pendente":
                custas_pendentes += v
            elif e.status == "pago" and e.paid_at and e.paid_at >= first_of_month:
                custas_pagas_mes += v
        elif e.tipo == "repasse_despachante":
            if e.status == "pendente":
                repasses_pendentes += v
            elif e.status == "pago" and e.paid_at and e.paid_at >= first_of_month:
                repasses_pagos_mes += v

    # ── Vencimentos próximos (7 dias) ─────────────────────────────────────────
    prox_row = await db.execute(
        sa.select(FinancialEntry)
        .where(
            FinancialEntry.status == "pendente",
            FinancialEntry.due_date.isnot(None),
            FinancialEntry.due_date <= seven_days,
            FinancialEntry.due_date >= now.date(),
        )
        .options(selectinload(FinancialEntry.procedure), selectinload(FinancialEntry.contract))
        .order_by(FinancialEntry.due_date)
        .limit(10)
    )
    prox_entries = prox_row.scalars().all()

    # ── Em atraso ─────────────────────────────────────────────────────────────
    atr_row = await db.execute(
        sa.select(FinancialEntry)
        .where(
            FinancialEntry.status == "pendente",
            FinancialEntry.due_date.isnot(None),
            FinancialEntry.due_date < now.date(),
        )
        .options(selectinload(FinancialEntry.procedure), selectinload(FinancialEntry.contract))
        .order_by(FinancialEntry.due_date)
        .limit(10)
    )
    atr_entries = atr_row.scalars().all()

    async def to_list(entries):
        result = []
        for e in entries:
            cname = await _client_name(db, e.client_id)
            proc_num = None
            if e.procedure:
                p = e.procedure
                proc_num = f"BMB-{p.year}-{str(p.protocol_number).zfill(4)}"
            cont_num = None
            if e.contract:
                c = e.contract
                cont_num = f"BMB-CTR-{c.contract_year}-{str(c.contract_number).zfill(4)}"
            result.append(_to_list_item(e, cname, proc_num, cont_num))
        return result

    return FinancialDashboard(
        honorarios_a_receber=hon_a_receber,
        honorarios_recebidos_mes=hon_recebidos_mes,
        custas_pendentes=custas_pendentes,
        custas_pagas_mes=custas_pagas_mes,
        repasses_pendentes=repasses_pendentes,
        repasses_pagos_mes=repasses_pagos_mes,
        vencimentos_proximos=await to_list(prox_entries),
        em_atraso=await to_list(atr_entries),
    )
