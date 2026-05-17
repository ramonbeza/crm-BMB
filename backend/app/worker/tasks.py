"""Placeholder de tasks Celery — expandir no Sprint 6 com Claude API."""
from app.worker.celery_app import celery_app


@celery_app.task(name="worker.ping")
def ping() -> str:
    return "pong"
