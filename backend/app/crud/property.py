from __future__ import annotations
import math
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.property import (
    CHECKLIST_TEMPLATES,
    PROPERTY_TYPE_LABELS,
    ChecklistItem,
    Property,
    PropertyClient,
)
from app.models.procedure import Procedure
from app.schemas.property import (
    ChecklistItemUpdate,
    PropertyCreate,
    PropertyUpdate,
)


# ── helpers ───────────────────────────────────────────────────────────────────

def _type_label(pt: str) -> str:
    return PROPERTY_TYPE_LABELS.get(pt, pt)


def _to_read(prop: Property, procedure_count: int = 0) -> dict:
    owners = []
    for link in prop.owner_links:
        owners.append(
            {
                "id": link.id,
                "client_id": link.client_id,
                "role": link.role,
                "client_name": None,
                "client_document": None,
            }
        )
    return {
        "id": prop.id,
        "matricula": prop.matricula,
        "inscricao_imobiliaria": prop.inscricao_imobiliaria,
        "incra_code": prop.incra_code,
        "property_type": prop.property_type,
        "property_type_label": _type_label(prop.property_type),
        "endereco": prop.endereco,
        "area_total": float(prop.area_total) if prop.area_total is not None else None,
        "area_unit": prop.area_unit,
        "cartorio": prop.cartorio,
        "confrontantes": prop.confrontantes,
        "notas": prop.notas,
        "is_active": prop.is_active,
        "created_at": prop.created_at,
        "updated_at": prop.updated_at,
        "owners": owners,
        "procedure_count": procedure_count,
    }


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def create_property(
    db: AsyncSession, *, obj_in: PropertyCreate, created_by_id: UUID
) -> dict:
    prop = Property(
        matricula=obj_in.matricula,
        inscricao_imobiliaria=obj_in.inscricao_imobiliaria,
        incra_code=obj_in.incra_code,
        property_type=obj_in.property_type,
        endereco=obj_in.endereco,
        area_total=obj_in.area_total,
        area_unit=obj_in.area_unit,
        cartorio=obj_in.cartorio,
        confrontantes=obj_in.confrontantes,
        notas=obj_in.notas,
        created_by_id=created_by_id,
    )
    db.add(prop)
    await db.flush()

    for owner in obj_in.owners:
        link = PropertyClient(
            property_id=prop.id,
            client_id=owner.client_id,
            role=owner.role,
        )
        db.add(link)

    await db.flush()
    await db.refresh(prop, ["owner_links"])
    proc_count = await _count_procedures(db, prop.id)
    await db.commit()
    return _to_read(prop, proc_count)


async def get_property(db: AsyncSession, property_id: UUID) -> Property | None:
    result = await db.execute(
        select(Property)
        .options(selectinload(Property.owner_links))
        .where(Property.id == property_id)
    )
    return result.scalar_one_or_none()


async def update_property(
    db: AsyncSession, *, db_obj: Property, obj_in: PropertyUpdate
) -> dict:
    for field, value in obj_in.model_dump(exclude_unset=True).items():
        setattr(db_obj, field, value)
    await db.flush()
    await db.refresh(db_obj, ["owner_links"])
    proc_count = await _count_procedures(db, db_obj.id)
    await db.commit()
    return _to_read(db_obj, proc_count)


async def list_properties(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
) -> dict:
    q = select(Property).where(Property.is_active.is_(True))
    if search:
        term = f"%{search}%"
        q = q.where(
            Property.matricula.ilike(term)
            | Property.inscricao_imobiliaria.ilike(term)
            | Property.endereco.ilike(term)
            | Property.cartorio.ilike(term)
        )

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = q.options(selectinload(Property.owner_links)).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()

    items = []
    for prop in rows:
        proc_count = await _count_procedures(db, prop.id)
        items.append(
            {
                "id": prop.id,
                "matricula": prop.matricula,
                "inscricao_imobiliaria": prop.inscricao_imobiliaria,
                "property_type": prop.property_type,
                "property_type_label": _type_label(prop.property_type),
                "endereco": prop.endereco,
                "area_total": float(prop.area_total) if prop.area_total is not None else None,
                "area_unit": prop.area_unit,
                "cartorio": prop.cartorio,
                "is_active": prop.is_active,
                "procedure_count": proc_count,
                "owner_names": [],
            }
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, math.ceil(total / page_size)),
    }


async def _count_procedures(db: AsyncSession, property_id: UUID) -> int:
    result = await db.execute(
        select(func.count()).where(Procedure.property_id == property_id)
    )
    return result.scalar_one()


# ── Checklist ─────────────────────────────────────────────────────────────────

async def seed_checklist(db: AsyncSession, procedure_id: UUID, procedure_type: str) -> list[ChecklistItem]:
    """Create checklist items for a procedure based on its type template."""
    template = CHECKLIST_TEMPLATES.get(procedure_type, [])
    items = []
    for i, item_def in enumerate(template, start=1):
        ci = ChecklistItem(
            procedure_id=procedure_id,
            order=i,
            name=item_def["name"],
            responsavel=item_def["responsavel"],
            status="pendente",
        )
        db.add(ci)
        items.append(ci)
    await db.flush()
    return items


async def get_checklist(db: AsyncSession, procedure_id: UUID) -> list[ChecklistItem]:
    result = await db.execute(
        select(ChecklistItem)
        .where(ChecklistItem.procedure_id == procedure_id)
        .order_by(ChecklistItem.order)
    )
    return list(result.scalars().all())


async def update_checklist_item(
    db: AsyncSession, *, item: ChecklistItem, obj_in: ChecklistItemUpdate
) -> ChecklistItem:
    from datetime import timezone, datetime as dt
    if obj_in.status is not None:
        item.status = obj_in.status
        if obj_in.status == "recebido" and item.received_at is None:
            item.received_at = dt.now(timezone.utc)
    if obj_in.notas is not None:
        item.notas = obj_in.notas
    await db.flush()
    await db.commit()
    await db.refresh(item)
    return item


async def get_checklist_item(db: AsyncSession, item_id: UUID) -> ChecklistItem | None:
    result = await db.execute(select(ChecklistItem).where(ChecklistItem.id == item_id))
    return result.scalar_one_or_none()


async def add_checklist_item(
    db: AsyncSession, procedure_id: UUID, name: str, responsavel: str = "cliente"
) -> ChecklistItem:
    # Find max order
    result = await db.execute(
        select(func.max(ChecklistItem.order)).where(ChecklistItem.procedure_id == procedure_id)
    )
    max_order = result.scalar_one() or 0
    ci = ChecklistItem(
        procedure_id=procedure_id,
        order=max_order + 1,
        name=name,
        responsavel=responsavel,
        status="pendente",
    )
    db.add(ci)
    await db.flush()
    await db.commit()
    await db.refresh(ci)
    return ci
