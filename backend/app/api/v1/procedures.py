from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

import sqlalchemy as sa
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client

from app.core.audit import audit
from app.core.deps import CurrentUser, InternalOnly, get_session, is_despachante
from app.crud.attendance import crud_attendance
from app.crud.procedure import crud_procedure
from app.models.procedure import PROCEDURE_TYPE_LABELS
from app.models.user import UserRole
from app.schemas.procedure import (
    AttachmentRead,
    CommentCreate,
    CommentRead,
    PaginatedProcedures,
    ProcedureCreate,
    ProcedureFromAttendance,
    ProcedureRead,
    ProcedureTypeOption,
    ProcedureUpdate,
    StageRead,
    StageUpdate,
    TaskCreate,
    TaskRead,
    TaskUpdate,
    TransferCreate,
    TransferRead,
    WorkspaceItem,
)

router = APIRouter()


@router.get("/types", response_model=list[ProcedureTypeOption])
async def list_procedure_types(_: CurrentUser):
    return [ProcedureTypeOption(value=k, label=v) for k, v in PROCEDURE_TYPE_LABELS.items()]


@router.get("", response_model=PaginatedProcedures)
async def list_procedures(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    procedure_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    client_id: UUID | None = Query(None),
    responsible_user_id: UUID | None = Query(None),
    tag: str | None = Query(None),
    property_id: UUID | None = Query(None),
):
    # Despachante-externo só vê procedimentos onde é executor
    executor_id: UUID | None = None
    if is_despachante(current_user):
        executor_id = current_user.id

    return await crud_procedure.list_paginated(
        db, page=page, page_size=page_size,
        procedure_type=procedure_type, status=status_filter,
        client_id=client_id, responsible_user_id=responsible_user_id,
        tag=tag, executor_user_id=executor_id, property_id=property_id,
    )


@router.post("", response_model=ProcedureRead, status_code=status.HTTP_201_CREATED)
async def create_procedure(
    request: Request,
    body: ProcedureCreate,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    result = await crud_procedure.create_procedure(db, obj_in=body, created_by_id=current_user.id)
    await audit(db, request, current_user, "procedure.created",
                entity_type="procedure", entity_id=str(result.id),
                details={"procedure_type": body.procedure_type, "client_id": str(body.client_id)})
    return result


@router.post("/from-attendance", response_model=ProcedureRead, status_code=status.HTTP_201_CREATED)
async def create_procedure_from_attendance(
    body: ProcedureFromAttendance,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    attendance = await crud_attendance.get_full(db, body.attendance_id)
    if not attendance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Atendimento não encontrado")
    return await crud_procedure.create_from_attendance(
        db, obj_in=body, attendance=attendance, created_by_id=current_user.id
    )


# ── Minha Área (workspace) — deve vir ANTES de /{procedure_id} ────────────────

@router.get("/minha-area", response_model=list[WorkspaceItem])
async def minha_area(
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    """Procedimentos em andamento do usuário logado (admin vê todos)."""
    from app.models.procedure import ProcedureTask, ProcedureStatus
    from app.models.user import UserRole

    stmt = (
        sa.select(Procedure)
        .options(
            selectinload(Procedure.client).selectinload(Client.pf_data),
            selectinload(Procedure.client).selectinload(Client.pj_data),
            selectinload(Procedure.stages),
        )
        .where(Procedure.status == ProcedureStatus.em_andamento)
        .order_by(Procedure.opened_at.desc())
    )
    if current_user.role != UserRole.admin:
        stmt = stmt.where(Procedure.responsible_user_id == current_user.id)

    procs = (await db.execute(stmt)).scalars().all()

    items: list[WorkspaceItem] = []
    for p in procs:
        client = p.client
        client_name = None
        if client:
            if client.pf_data:
                client_name = client.pf_data.name
            elif client.pj_data:
                client_name = client.pj_data.company_name

        stages_done = sum(1 for s in p.stages if s.status == "concluida")
        stages_total = len(p.stages)

        task_count = await db.scalar(
            sa.select(sa.func.count()).select_from(ProcedureTask)
            .where(ProcedureTask.procedure_id == p.id, ProcedureTask.status == "pendente")
        )

        items.append(WorkspaceItem(
            id=p.id,
            protocol_number=p.protocol_number,
            client_name=client_name,
            procedure_type=p.procedure_type,
            procedure_type_label=PROCEDURE_TYPE_LABELS.get(p.procedure_type, p.procedure_type),
            status=p.status,
            opened_at=p.opened_at,
            deadline=p.deadline,
            tags=p.tags or [],
            stages_done=stages_done,
            stages_total=stages_total,
            pending_tasks=task_count or 0,
        ))

    return items


@router.get("/{procedure_id}", response_model=ProcedureRead)
async def get_procedure(
    procedure_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    p = await crud_procedure.get_full(db, procedure_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Procedimento não encontrado")
    # Despachante só pode ver seu próprio procedimento
    if is_despachante(current_user) and p.executor_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado a este procedimento.")
    return crud_procedure._to_read(p)


@router.put("/{procedure_id}", response_model=ProcedureRead)
async def update_procedure(
    request: Request,
    procedure_id: UUID,
    body: ProcedureUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    p = await crud_procedure.get_full(db, procedure_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Procedimento não encontrado")
    # Despachante só pode atualizar etapas — não dados gerais do procedimento
    if is_despachante(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Despachante-externo não pode editar dados do procedimento. Use a rota de etapas.",
        )
    # Valida que executor_user_id pertence a um despachante-externo
    if body.executor_user_id is not None:
        import sqlalchemy as sa
        from app.models.user import User
        res = await db.execute(sa.select(User).where(User.id == body.executor_user_id))
        executor = res.scalar_one_or_none()
        if not executor:
            raise HTTPException(status_code=404, detail="Usuário executor não encontrado.")
        if executor.role != UserRole.despachante_externo:
            raise HTTPException(
                status_code=422,
                detail=f"Usuário '{executor.name}' não é despachante-externo (role atual: {executor.role}).",
            )
    old_status = p.status
    result = await crud_procedure.update_procedure(db, db_obj=p, obj_in=body)
    # Audita apenas quando há mudança de status
    if body.status and body.status != old_status:
        await audit(db, request, current_user, "procedure.status_changed",
                    entity_type="procedure", entity_id=str(procedure_id),
                    details={"old_status": old_status, "new_status": body.status})
    return result


@router.put("/{procedure_id}/stages/{stage_id}", response_model=StageRead)
async def update_stage(
    procedure_id: UUID,
    stage_id: UUID,
    body: StageUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    stage = await crud_procedure.get_stage(db, stage_id)
    if not stage or stage.procedure_id != procedure_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Etapa não encontrada")

    # Despachante pode atualizar etapas do seu procedimento
    if is_despachante(current_user):
        p = await crud_procedure.get_full(db, procedure_id)
        if not p or p.executor_user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado.")

    return await crud_procedure.update_stage(db, stage=stage, obj_in=body)


@router.delete("/{procedure_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_procedure(
    request: Request,
    procedure_id: UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    if current_user.role not in (UserRole.admin, UserRole.advogado):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas admin ou advogado podem excluir procedimentos",
        )
    p = await crud_procedure.get_full(db, procedure_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Procedimento não encontrado")
    await audit(db, request, current_user, "procedure.deleted",
                entity_type="procedure", entity_id=str(procedure_id),
                details={"protocol_number": p.protocol_number})
    await db.delete(p)
    await db.flush()


# ── Transferência ──────────────────────────────────────────────────────────────

@router.post("/{procedure_id}/transferir", response_model=TransferRead, status_code=status.HTTP_201_CREATED)
async def transferir_procedimento(
    request: Request,
    procedure_id: UUID,
    body: TransferCreate,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.procedure import ProcedureTransfer
    from app.models.user import User, UserRole

    p = await crud_procedure.get_full(db, procedure_id)
    if not p:
        raise HTTPException(status_code=404, detail="Procedimento não encontrado")

    # Quem pode transferir: admin ou responsável atual
    if current_user.role != UserRole.admin and p.responsible_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Apenas o responsável atual ou administrador pode transferir.")

    # Valida usuário de destino
    dest = await db.scalar(sa.select(User).where(User.id == body.to_user_id))
    if not dest:
        raise HTTPException(status_code=404, detail="Usuário de destino não encontrado")
    if not dest.is_active:
        raise HTTPException(status_code=422, detail="Usuário de destino está inativo")
    if dest.role == UserRole.despachante_externo:
        raise HTTPException(status_code=422, detail="Despachante-externo não pode ser responsável por um procedimento")

    from_user_id = p.responsible_user_id
    transfer = ProcedureTransfer(
        procedure_id=procedure_id,
        from_user_id=from_user_id,
        to_user_id=body.to_user_id,
        transferred_by_id=current_user.id,
        notes=body.notes,
    )
    db.add(transfer)

    p.responsible_user_id = body.to_user_id
    await db.flush()
    await db.refresh(transfer, ["from_user", "to_user", "transferred_by"])

    await audit(db, request, current_user, "procedure.transferred",
                entity_type="procedure", entity_id=str(procedure_id),
                details={"to_user_id": str(body.to_user_id), "to_user_name": dest.name})

    from_name = transfer.from_user.name if transfer.from_user else None
    to_name = transfer.to_user.name if transfer.to_user else None
    by_name = transfer.transferred_by.name if transfer.transferred_by else None

    return TransferRead(
        id=transfer.id,
        procedure_id=transfer.procedure_id,
        from_user_id=transfer.from_user_id,
        from_user_name=from_name,
        to_user_id=transfer.to_user_id,
        to_user_name=to_name,
        transferred_by_id=transfer.transferred_by_id,
        transferred_by_name=by_name,
        notes=transfer.notes,
        created_at=transfer.created_at,
    )


@router.get("/{procedure_id}/transferencias", response_model=list[TransferRead])
async def listar_transferencias(
    procedure_id: UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.procedure import ProcedureTransfer
    from app.models.user import User

    stmt = (
        sa.select(ProcedureTransfer)
        .options(
            selectinload(ProcedureTransfer.from_user),
            selectinload(ProcedureTransfer.to_user),
            selectinload(ProcedureTransfer.transferred_by),
        )
        .where(ProcedureTransfer.procedure_id == procedure_id)
        .order_by(ProcedureTransfer.created_at.asc())
    )
    transfers = (await db.execute(stmt)).scalars().all()

    return [
        TransferRead(
            id=t.id,
            procedure_id=t.procedure_id,
            from_user_id=t.from_user_id,
            from_user_name=t.from_user.name if t.from_user else None,
            to_user_id=t.to_user_id,
            to_user_name=t.to_user.name if t.to_user else None,
            transferred_by_id=t.transferred_by_id,
            transferred_by_name=t.transferred_by.name if t.transferred_by else None,
            notes=t.notes,
            created_at=t.created_at,
        )
        for t in transfers
    ]


# ── Comentários internos ───────────────────────────────────────────────────────

@router.get("/{procedure_id}/comentarios", response_model=list[CommentRead])
async def listar_comentarios(
    procedure_id: UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.procedure import ProcedureComment

    stmt = (
        sa.select(ProcedureComment)
        .options(selectinload(ProcedureComment.author))
        .where(ProcedureComment.procedure_id == procedure_id)
        .order_by(ProcedureComment.created_at.asc())
    )
    comments = (await db.execute(stmt)).scalars().all()

    return [
        CommentRead(
            id=c.id,
            procedure_id=c.procedure_id,
            author_id=c.author_id,
            author_name=c.author.name if c.author else None,
            content=c.content,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in comments
    ]


@router.post("/{procedure_id}/comentarios", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
async def criar_comentario(
    procedure_id: UUID,
    body: CommentCreate,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.procedure import ProcedureComment

    p = await db.scalar(sa.select(Procedure).where(Procedure.id == procedure_id))
    if not p:
        raise HTTPException(status_code=404, detail="Procedimento não encontrado")

    comment = ProcedureComment(
        procedure_id=procedure_id,
        author_id=current_user.id,
        content=body.content,
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment, ["author"])

    return CommentRead(
        id=comment.id,
        procedure_id=comment.procedure_id,
        author_id=comment.author_id,
        author_name=comment.author.name if comment.author else None,
        content=comment.content,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.delete("/{procedure_id}/comentarios/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletar_comentario(
    procedure_id: UUID,
    comment_id: UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.procedure import ProcedureComment
    from app.models.user import UserRole

    c = await db.scalar(
        sa.select(ProcedureComment).where(
            ProcedureComment.id == comment_id,
            ProcedureComment.procedure_id == procedure_id,
        )
    )
    if not c:
        raise HTTPException(status_code=404, detail="Comentário não encontrado")
    if c.author_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Só o autor ou admin pode excluir este comentário")

    await db.delete(c)
    await db.flush()


# ── Tarefas internas ───────────────────────────────────────────────────────────

@router.get("/{procedure_id}/tarefas", response_model=list[TaskRead])
async def listar_tarefas(
    procedure_id: UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.procedure import ProcedureTask

    stmt = (
        sa.select(ProcedureTask)
        .options(
            selectinload(ProcedureTask.assigned_to),
            selectinload(ProcedureTask.created_by),
        )
        .where(ProcedureTask.procedure_id == procedure_id)
        .order_by(ProcedureTask.created_at.asc())
    )
    tasks = (await db.execute(stmt)).scalars().all()

    return [_task_read(t) for t in tasks]


@router.post("/{procedure_id}/tarefas", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def criar_tarefa(
    procedure_id: UUID,
    body: TaskCreate,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.procedure import ProcedureTask

    p = await db.scalar(sa.select(Procedure).where(Procedure.id == procedure_id))
    if not p:
        raise HTTPException(status_code=404, detail="Procedimento não encontrado")

    task = ProcedureTask(
        procedure_id=procedure_id,
        title=body.title,
        description=body.description,
        assigned_to_id=body.assigned_to_id,
        created_by_id=current_user.id,
        due_date=body.due_date,
        status="pendente",
    )
    db.add(task)
    await db.flush()
    await db.refresh(task, ["assigned_to", "created_by"])

    return _task_read(task)


@router.patch("/{procedure_id}/tarefas/{task_id}", response_model=TaskRead)
async def atualizar_tarefa(
    procedure_id: UUID,
    task_id: UUID,
    body: TaskUpdate,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.procedure import ProcedureTask

    task = await db.scalar(
        sa.select(ProcedureTask)
        .options(selectinload(ProcedureTask.assigned_to), selectinload(ProcedureTask.created_by))
        .where(ProcedureTask.id == task_id, ProcedureTask.procedure_id == procedure_id)
    )
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")

    if body.title is not None:
        task.title = body.title
    if body.description is not None:
        task.description = body.description
    if body.assigned_to_id is not None:
        task.assigned_to_id = body.assigned_to_id
    if body.due_date is not None:
        task.due_date = body.due_date
    if body.status is not None:
        task.status = body.status
        if body.status == "concluida" and task.completed_at is None:
            task.completed_at = datetime.now(timezone.utc)
        elif body.status == "pendente":
            task.completed_at = None

    await db.flush()
    await db.refresh(task, ["assigned_to", "created_by"])
    return _task_read(task)


@router.delete("/{procedure_id}/tarefas/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletar_tarefa(
    procedure_id: UUID,
    task_id: UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.procedure import ProcedureTask

    task = await db.scalar(
        sa.select(ProcedureTask).where(ProcedureTask.id == task_id, ProcedureTask.procedure_id == procedure_id)
    )
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")

    await db.delete(task)
    await db.flush()


# ── Anexos ─────────────────────────────────────────────────────────────────────

@router.get("/{procedure_id}/anexos", response_model=list[AttachmentRead])
async def listar_anexos(
    procedure_id: UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.procedure import ProcedureAttachment

    stmt = (
        sa.select(ProcedureAttachment)
        .options(selectinload(ProcedureAttachment.uploaded_by))
        .where(ProcedureAttachment.procedure_id == procedure_id)
        .order_by(ProcedureAttachment.created_at.desc())
    )
    attachments = (await db.execute(stmt)).scalars().all()

    return [_attachment_read(a) for a in attachments]


@router.post("/{procedure_id}/anexos", response_model=AttachmentRead, status_code=status.HTTP_201_CREATED)
async def upload_anexo(
    procedure_id: UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
    file: UploadFile = File(...),
):
    from app.core.config import settings
    from app.models.procedure import ProcedureAttachment
    from minio import Minio
    from minio.error import S3Error

    p = await db.scalar(sa.select(Procedure).where(Procedure.id == procedure_id))
    if not p:
        raise HTTPException(status_code=404, detail="Procedimento não encontrado")

    file_data = await file.read()
    file_size = len(file_data)
    import io
    storage_key = f"procedimentos/{procedure_id}/{file.filename}"

    try:
        client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        if not client.bucket_exists(settings.MINIO_BUCKET):
            client.make_bucket(settings.MINIO_BUCKET)
        client.put_object(
            settings.MINIO_BUCKET,
            storage_key,
            io.BytesIO(file_data),
            length=file_size,
            content_type=file.content_type or "application/octet-stream",
        )
    except S3Error as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar arquivo: {e}")

    attachment = ProcedureAttachment(
        procedure_id=procedure_id,
        uploaded_by_id=current_user.id,
        filename=file.filename or "arquivo",
        content_type=file.content_type,
        file_size=file_size,
        storage_key=storage_key,
    )
    db.add(attachment)
    await db.flush()
    await db.refresh(attachment, ["uploaded_by"])

    return _attachment_read(attachment)


@router.delete("/{procedure_id}/anexos/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletar_anexo(
    procedure_id: UUID,
    attachment_id: UUID,
    current_user: InternalOnly,
    db: Annotated[AsyncSession, Depends(get_session)],
):
    from app.core.config import settings
    from app.models.procedure import ProcedureAttachment
    from app.models.user import UserRole
    from minio import Minio

    a = await db.scalar(
        sa.select(ProcedureAttachment).where(
            ProcedureAttachment.id == attachment_id,
            ProcedureAttachment.procedure_id == procedure_id,
        )
    )
    if not a:
        raise HTTPException(status_code=404, detail="Anexo não encontrado")
    if a.uploaded_by_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Só o uploader ou admin pode excluir este anexo")

    try:
        minio_client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        minio_client.remove_object(settings.MINIO_BUCKET, a.storage_key)
    except Exception:
        pass  # Se falhar no MinIO, ainda remove do banco

    await db.delete(a)
    await db.flush()


# ── Helpers privados ───────────────────────────────────────────────────────────

def _task_read(t) -> TaskRead:
    return TaskRead(
        id=t.id,
        procedure_id=t.procedure_id,
        title=t.title,
        description=t.description,
        assigned_to_id=t.assigned_to_id,
        assigned_to_name=t.assigned_to.name if t.assigned_to else None,
        created_by_id=t.created_by_id,
        created_by_name=t.created_by.name if t.created_by else None,
        due_date=t.due_date,
        status=t.status,
        completed_at=t.completed_at,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


def _attachment_read(a) -> AttachmentRead:
    return AttachmentRead(
        id=a.id,
        procedure_id=a.procedure_id,
        uploaded_by_id=a.uploaded_by_id,
        uploaded_by_name=a.uploaded_by.name if a.uploaded_by else None,
        filename=a.filename,
        content_type=a.content_type,
        file_size=a.file_size,
        created_at=a.created_at,
    )
