import re
import unicodedata
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.procedure import PROCEDURE_TYPE_LABELS, Procedure, ProcedureTypeCatalog
from app.schemas.procedure_type import ProcedureTypeCreate, ProcedureTypeUpdate


def _slugify(label: str) -> str:
    normalized = unicodedata.normalize("NFKD", label).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "_", normalized.lower()).strip("_")
    return slug[:60] or "tipo"


class CRUDProcedureType:
    async def list_all(self, db: AsyncSession, *, active_only: bool = False) -> list[ProcedureTypeCatalog]:
        stmt = select(ProcedureTypeCatalog).order_by(ProcedureTypeCatalog.sort_order, ProcedureTypeCatalog.label)
        if active_only:
            stmt = stmt.where(ProcedureTypeCatalog.is_active.is_(True))
        return list((await db.execute(stmt)).scalars().all())

    async def get(self, db: AsyncSession, id: UUID) -> ProcedureTypeCatalog | None:
        return (
            await db.execute(select(ProcedureTypeCatalog).where(ProcedureTypeCatalog.id == id))
        ).scalar_one_or_none()

    async def get_by_code(self, db: AsyncSession, code: str) -> ProcedureTypeCatalog | None:
        return (
            await db.execute(select(ProcedureTypeCatalog).where(ProcedureTypeCatalog.code == code))
        ).scalar_one_or_none()

    async def is_in_use(self, db: AsyncSession, code: str) -> bool:
        count = (
            await db.execute(select(func.count()).select_from(Procedure).where(Procedure.procedure_type == code))
        ).scalar_one()
        return count > 0

    async def get_in_use_codes(self, db: AsyncSession) -> set[str]:
        rows = (await db.execute(select(Procedure.procedure_type).distinct())).scalars().all()
        return set(rows)

    async def create(self, db: AsyncSession, *, obj_in: ProcedureTypeCreate) -> ProcedureTypeCatalog:
        base_code = _slugify(obj_in.label)
        code = base_code
        suffix = 2
        while await self.get_by_code(db, code):
            code = f"{base_code}_{suffix}"
            suffix += 1

        max_order = (await db.execute(select(func.max(ProcedureTypeCatalog.sort_order)))).scalar_one() or 0

        obj = ProcedureTypeCatalog(code=code, label=obj_in.label, is_active=True, sort_order=max_order + 1)
        db.add(obj)
        await db.flush()
        await db.refresh(obj)
        PROCEDURE_TYPE_LABELS[obj.code] = obj.label
        return obj

    async def update(
        self, db: AsyncSession, *, db_obj: ProcedureTypeCatalog, obj_in: ProcedureTypeUpdate
    ) -> ProcedureTypeCatalog:
        data = obj_in.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        PROCEDURE_TYPE_LABELS[db_obj.code] = db_obj.label
        return db_obj

    async def delete(self, db: AsyncSession, *, db_obj: ProcedureTypeCatalog) -> None:
        await db.delete(db_obj)
        await db.flush()
        PROCEDURE_TYPE_LABELS.pop(db_obj.code, None)

    async def get_label_map(self, db: AsyncSession) -> dict[str, str]:
        """Mapa código→label sempre atualizado, direto do banco (evita cache defasado entre workers)."""
        rows = (await db.execute(select(ProcedureTypeCatalog.code, ProcedureTypeCatalog.label))).all()
        return dict(rows)

    async def sync_label_cache(self, db: AsyncSession) -> None:
        """Recarrega PROCEDURE_TYPE_LABELS a partir do banco (chamado no startup de cada worker)."""
        rows = await self.list_all(db)
        for row in rows:
            PROCEDURE_TYPE_LABELS[row.code] = row.label


crud_procedure_type = CRUDProcedureType()
