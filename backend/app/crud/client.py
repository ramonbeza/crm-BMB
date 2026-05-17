import math
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.base import CRUDBase
from app.models.client import Client, ClientPF, ClientPJ, ClientType
from app.schemas.client import (
    ClientListItem,
    ClientPFCreate,
    ClientPFUpdate,
    ClientPJCreate,
    ClientPJUpdate,
    PaginatedClients,
)


class CRUDClient(CRUDBase[Client]):
    def _with_relations(self):
        return select(Client).options(
            selectinload(Client.pf_data),
            selectinload(Client.pj_data),
        )

    async def get_with_data(self, db: AsyncSession, id: UUID) -> Client | None:
        result = await db.execute(
            self._with_relations().where(Client.id == id)
        )
        return result.scalar_one_or_none()

    async def create_pf(
        self, db: AsyncSession, *, obj_in: ClientPFCreate, created_by_id: UUID
    ) -> Client:
        client = Client(
            client_type=ClientType.PF,
            phone=obj_in.phone,
            email=obj_in.email,
            notes=obj_in.notes,
            created_by_id=created_by_id,
        )
        db.add(client)
        await db.flush()

        pf = ClientPF(
            client_id=client.id,
            name=obj_in.pf_data.name,
            cpf=obj_in.pf_data.cpf,
            birth_date=obj_in.pf_data.birth_date,
            civil_status=obj_in.pf_data.civil_status,
            rg=obj_in.pf_data.rg,
            cnh=obj_in.pf_data.cnh,
            address=obj_in.pf_data.address,
        )
        db.add(pf)
        await db.flush()
        await db.refresh(client)
        return await self.get_with_data(db, client.id)

    async def create_pj(
        self, db: AsyncSession, *, obj_in: ClientPJCreate, created_by_id: UUID
    ) -> Client:
        client = Client(
            client_type=ClientType.PJ,
            phone=obj_in.phone,
            email=obj_in.email,
            notes=obj_in.notes,
            created_by_id=created_by_id,
        )
        db.add(client)
        await db.flush()

        pj = ClientPJ(
            client_id=client.id,
            company_name=obj_in.pj_data.company_name,
            cnpj=obj_in.pj_data.cnpj,
            address=obj_in.pj_data.address,
        )
        db.add(pj)
        await db.flush()
        await db.refresh(client)
        return await self.get_with_data(db, client.id)

    async def update_pf(
        self, db: AsyncSession, *, db_obj: Client, obj_in: ClientPFUpdate
    ) -> Client:
        if obj_in.phone is not None:
            db_obj.phone = obj_in.phone
        if obj_in.email is not None:
            db_obj.email = obj_in.email
        if obj_in.notes is not None:
            db_obj.notes = obj_in.notes
        db.add(db_obj)

        if obj_in.pf_data and db_obj.pf_data:
            pf = db_obj.pf_data
            data = obj_in.pf_data
            for field in ("name", "cpf", "birth_date", "civil_status", "rg", "cnh", "address"):
                val = getattr(data, field)
                if val is not None:
                    setattr(pf, field, val)
            db.add(pf)

        await db.flush()
        return await self.get_with_data(db, db_obj.id)

    async def update_pj(
        self, db: AsyncSession, *, db_obj: Client, obj_in: ClientPJUpdate
    ) -> Client:
        if obj_in.phone is not None:
            db_obj.phone = obj_in.phone
        if obj_in.email is not None:
            db_obj.email = obj_in.email
        if obj_in.notes is not None:
            db_obj.notes = obj_in.notes
        db.add(db_obj)

        if obj_in.pj_data and db_obj.pj_data:
            pj = db_obj.pj_data
            data = obj_in.pj_data
            for field in ("company_name", "cnpj", "address"):
                val = getattr(data, field)
                if val is not None:
                    setattr(pj, field, val)
            db.add(pj)

        await db.flush()
        return await self.get_with_data(db, db_obj.id)

    async def soft_delete(self, db: AsyncSession, *, id: UUID) -> Client | None:
        client = await self.get_with_data(db, id)
        if client:
            client.is_active = False
            db.add(client)
            await db.flush()
        return client

    async def list_paginated(
        self,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        client_type: ClientType | None = None,
        active_only: bool = True,
    ) -> PaginatedClients:
        base_q = self._with_relations()

        if active_only:
            base_q = base_q.where(Client.is_active == True)
        if client_type:
            base_q = base_q.where(Client.client_type == client_type)
        if search:
            term = f"%{search}%"
            base_q = base_q.join(ClientPF, ClientPF.client_id == Client.id, isouter=True).join(
                ClientPJ, ClientPJ.client_id == Client.id, isouter=True
            ).where(
                or_(
                    ClientPF.name.ilike(term),
                    ClientPF.cpf.ilike(term),
                    ClientPJ.company_name.ilike(term),
                    ClientPJ.cnpj.ilike(term),
                    Client.email.ilike(term),
                    Client.phone.ilike(term),
                )
            )

        count_q = select(func.count()).select_from(base_q.subquery())
        total = (await db.execute(count_q)).scalar_one()

        offset = (page - 1) * page_size
        result = await db.execute(base_q.offset(offset).limit(page_size).order_by(Client.created_at.desc()))
        clients = list(result.scalars().unique().all())

        items = []
        for c in clients:
            if c.client_type == ClientType.PF and c.pf_data:
                display_name = c.pf_data.name
                document = c.pf_data.cpf
            elif c.client_type == ClientType.PJ and c.pj_data:
                display_name = c.pj_data.company_name
                document = c.pj_data.cnpj
            else:
                display_name = "—"
                document = "—"

            items.append(
                ClientListItem(
                    id=c.id,
                    client_type=c.client_type,
                    phone=c.phone,
                    email=c.email,
                    is_active=c.is_active,
                    created_at=c.created_at,
                    display_name=display_name,
                    document=document,
                )
            )

        return PaginatedClients(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total else 0,
        )


crud_client = CRUDClient(Client)
