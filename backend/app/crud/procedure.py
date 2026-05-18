import math
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.base import CRUDBase
from app.models.client import Client, ClientType
from app.models.meeting import Attendance
from app.models.procedure import (
    PROCEDURE_TYPE_LABELS,
    STANDARD_STAGES,
    Procedure,
    ProcedureStage,
    StageStatus,
)
from app.schemas.procedure import (
    PaginatedProcedures,
    ProcedureCreate,
    ProcedureFromAttendance,
    ProcedureListItem,
    ProcedureRead,
    ProcedureUpdate,
    StageRead,
    StageUpdate,
)


def _client_display(client: Client | None) -> str | None:
    if client is None:
        return None
    if client.client_type == ClientType.PF and client.pf_data:
        return client.pf_data.name
    if client.client_type == ClientType.PJ and client.pj_data:
        return client.pj_data.company_name
    return None


class CRUDProcedure(CRUDBase[Procedure]):
    def _q(self):
        from app.models.property import ChecklistItem
        return select(Procedure).options(
            selectinload(Procedure.client).selectinload(Client.pf_data),
            selectinload(Procedure.client).selectinload(Client.pj_data),
            selectinload(Procedure.responsible),
            selectinload(Procedure.stages).selectinload(ProcedureStage.assigned_user),
            selectinload(Procedure.checklist_items),
        )

    async def get_full(self, db: AsyncSession, id: UUID) -> Procedure | None:
        res = await db.execute(self._q().where(Procedure.id == id))
        return res.scalar_one_or_none()

    def _stage_read(self, s: ProcedureStage) -> StageRead:
        return StageRead(
            id=s.id,
            procedure_id=s.procedure_id,
            order=s.order,
            name=s.name,
            status=s.status,
            assigned_user_id=s.assigned_user_id,
            assigned_user_name=s.assigned_user.name if s.assigned_user else None,
            due_date=s.due_date,
            completed_at=s.completed_at,
            notes=s.notes,
        )

    def _to_read(self, p: Procedure) -> ProcedureRead:
        from app.schemas.procedure import ChecklistItemRead
        return ProcedureRead(
            id=p.id,
            protocol_number=p.protocol_number,
            client_id=p.client_id,
            procedure_type=p.procedure_type,
            procedure_type_label=PROCEDURE_TYPE_LABELS.get(p.procedure_type, p.procedure_type),
            opened_at=p.opened_at,
            description=p.description,
            property_description=p.property_description,
            matricula=p.matricula,
            incra=p.incra,
            inscricao_imobiliaria=p.inscricao_imobiliaria,
            requerente=p.requerente,
            deadline=p.deadline,
            tags=p.tags or [],
            status=p.status,
            responsible_user_id=p.responsible_user_id,
            property_id=p.property_id,
            attendance_id=p.attendance_id,
            created_at=p.created_at,
            updated_at=p.updated_at,
            client_name=_client_display(p.client),
            responsible_name=p.responsible.name if p.responsible else None,
            stages=[self._stage_read(s) for s in sorted(p.stages, key=lambda x: x.order)],
            checklist_items=[
                ChecklistItemRead(
                    id=ci.id,
                    procedure_id=ci.procedure_id,
                    order=ci.order,
                    name=ci.name,
                    responsavel=ci.responsavel,
                    status=ci.status,
                    notas=ci.notas,
                    received_at=ci.received_at,
                )
                for ci in sorted(p.checklist_items, key=lambda x: x.order)
            ],
        )

    async def _next_protocol(self, db: AsyncSession) -> int:
        res = await db.execute(text("SELECT nextval('procedure_protocol_seq')"))
        return int(res.scalar_one())

    async def _create_internal(
        self, db: AsyncSession, *, data: ProcedureCreate, created_by_id: UUID, attendance_id: UUID | None
    ) -> ProcedureRead:
        protocol = await self._next_protocol(db)
        p = Procedure(
            protocol_number=protocol,
            client_id=data.client_id,
            procedure_type=data.procedure_type,
            opened_at=data.opened_at,
            description=data.description,
            property_description=data.property_description,
            matricula=data.matricula,
            incra=data.incra,
            inscricao_imobiliaria=data.inscricao_imobiliaria,
            requerente=data.requerente,
            deadline=data.deadline,
            tags=data.tags or [],
            responsible_user_id=data.responsible_user_id,
            property_id=getattr(data, "property_id", None),
            attendance_id=attendance_id,
            created_by_id=created_by_id,
        )
        db.add(p)
        await db.flush()

        for idx, stage_name in enumerate(STANDARD_STAGES, start=1):
            db.add(
                ProcedureStage(
                    procedure_id=p.id,
                    order=idx,
                    name=stage_name,
                    status=StageStatus.pendente,
                )
            )

        # Seed checklist from template
        from app.crud.property import seed_checklist
        await seed_checklist(db, p.id, data.procedure_type)

        await db.flush()
        return self._to_read(await self.get_full(db, p.id))

    async def create_procedure(
        self, db: AsyncSession, *, obj_in: ProcedureCreate, created_by_id: UUID
    ) -> ProcedureRead:
        return await self._create_internal(
            db, data=obj_in, created_by_id=created_by_id, attendance_id=None
        )

    async def create_from_attendance(
        self, db: AsyncSession, *, obj_in: ProcedureFromAttendance, attendance: Attendance, created_by_id: UUID
    ) -> ProcedureRead:
        result = await self._create_internal(
            db, data=obj_in, created_by_id=created_by_id, attendance_id=attendance.id
        )
        attendance.converted_to_procedure = True
        db.add(attendance)
        await db.flush()
        return result

    async def update_procedure(
        self, db: AsyncSession, *, db_obj: Procedure, obj_in: ProcedureUpdate
    ) -> ProcedureRead:
        for field in (
            "procedure_type", "opened_at", "description", "property_description",
            "matricula", "incra", "inscricao_imobiliaria", "requerente",
            "deadline", "tags", "status", "responsible_user_id", "property_id",
        ):
            val = getattr(obj_in, field)
            if val is not None:
                setattr(db_obj, field, val)
        db.add(db_obj)
        await db.flush()
        return self._to_read(await self.get_full(db, db_obj.id))

    async def update_stage(
        self, db: AsyncSession, *, stage: ProcedureStage, obj_in: StageUpdate
    ) -> StageRead:
        from datetime import datetime, timezone

        if obj_in.status is not None:
            stage.status = obj_in.status
            if obj_in.status == StageStatus.concluida and stage.completed_at is None:
                stage.completed_at = datetime.now(timezone.utc)
            if obj_in.status != StageStatus.concluida:
                stage.completed_at = None
        if obj_in.assigned_user_id is not None:
            stage.assigned_user_id = obj_in.assigned_user_id
        if obj_in.due_date is not None:
            stage.due_date = obj_in.due_date
        if obj_in.notes is not None:
            stage.notes = obj_in.notes
        db.add(stage)
        await db.flush()
        res = await db.execute(
            select(ProcedureStage)
            .options(selectinload(ProcedureStage.assigned_user))
            .where(ProcedureStage.id == stage.id)
        )
        return self._stage_read(res.scalar_one())

    async def get_stage(self, db: AsyncSession, stage_id: UUID) -> ProcedureStage | None:
        res = await db.execute(select(ProcedureStage).where(ProcedureStage.id == stage_id))
        return res.scalar_one_or_none()

    async def list_paginated(
        self,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 20,
        procedure_type: str | None = None,
        status: str | None = None,
        client_id: UUID | None = None,
        responsible_user_id: UUID | None = None,
        tag: str | None = None,
    ) -> PaginatedProcedures:
        q = self._q()
        if procedure_type:
            q = q.where(Procedure.procedure_type == procedure_type)
        if status:
            q = q.where(Procedure.status == status)
        if client_id:
            q = q.where(Procedure.client_id == client_id)
        if responsible_user_id:
            q = q.where(Procedure.responsible_user_id == responsible_user_id)
        if tag:
            q = q.where(Procedure.tags.contains([tag]))

        total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
        offset = (page - 1) * page_size
        res = await db.execute(
            q.order_by(Procedure.protocol_number.desc()).offset(offset).limit(page_size)
        )
        procs = list(res.scalars().unique().all())

        items = []
        for p in procs:
            done = sum(1 for s in p.stages if s.status == StageStatus.concluida)
            items.append(
                ProcedureListItem(
                    id=p.id,
                    protocol_number=p.protocol_number,
                    client_name=_client_display(p.client),
                    procedure_type=p.procedure_type,
                    procedure_type_label=PROCEDURE_TYPE_LABELS.get(p.procedure_type, p.procedure_type),
                    status=p.status,
                    opened_at=p.opened_at,
                    deadline=p.deadline,
                    tags=p.tags or [],
                    responsible_name=p.responsible.name if p.responsible else None,
                    stages_done=done,
                    stages_total=len(p.stages),
                )
            )

        return PaginatedProcedures(
            items=items, total=total, page=page, page_size=page_size,
            pages=math.ceil(total / page_size) if total else 0,
        )


crud_procedure = CRUDProcedure(Procedure)
