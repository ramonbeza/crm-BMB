from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "crm_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Sao_Paulo",
    enable_utc=True,
    # ── Agendamentos automáticos (Celery Beat) ────────────────────────────────
    beat_schedule={
        # Verifica prazos todos os dias às 08h00 (horário de Brasília)
        "check-deadlines-daily": {
            "task": "worker.check_deadlines",
            "schedule": crontab(hour=8, minute=0),
        },
    },
)
