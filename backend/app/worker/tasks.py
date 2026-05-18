"""
Tasks Celery — envio de mensagens (email SMTP e WhatsApp Z-API/Evolution API)
"""
from __future__ import annotations

import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.worker.celery_app import celery_app


# ── Ping ──────────────────────────────────────────────────────────────────────

@celery_app.task(name="worker.ping")
def ping() -> str:
    return "pong"


# ── Helpers de banco (síncrono via psycopg2) ──────────────────────────────────

def _update_comm_status(
    comm_id: str,
    status: str,
    *,
    error_message: str | None = None,
    provider_meta: dict | None = None,
) -> None:
    """Atualiza status de uma Communication diretamente via psycopg2 (síncrono)."""
    import json
    import os

    import psycopg2

    dsn = os.environ.get("DATABASE_URL_SYNC", "")
    if not dsn:
        return

    updates = ["status = %s", "updated_at = now()"]
    params: list = [status]

    if status == "enviado":
        updates.append("sent_at = now()")
    if error_message is not None:
        updates.append("error_message = %s")
        params.append(error_message)
    if provider_meta is not None:
        updates.append("provider_meta = %s")
        params.append(json.dumps(provider_meta))

    params.append(comm_id)
    sql = f"UPDATE communications SET {', '.join(updates)} WHERE id = %s"

    try:
        conn = psycopg2.connect(dsn)
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
        conn.close()
    except Exception:
        pass  # Best-effort — não derruba o worker por falha de log


# ── Email via SMTP ────────────────────────────────────────────────────────────

@celery_app.task(name="worker.send_email", bind=True, max_retries=3, default_retry_delay=60)
def send_email(
    self,
    comm_id: str,
    to_name: str | None,
    to_email: str,
    subject: str,
    body: str,
) -> dict:
    from app.core.config import settings

    if not settings.SMTP_HOST:
        _update_comm_status(comm_id, "falhou", error_message="SMTP_HOST não configurado")
        return {"ok": False, "error": "SMTP not configured"}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email

        msg.attach(MIMEText(body, "plain", "utf-8"))
        msg.attach(MIMEText(f"<pre style='font-family:sans-serif'>{body}</pre>", "html", "utf-8"))

        context = ssl.create_default_context() if settings.SMTP_TLS else None

        if settings.SMTP_TLS:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.ehlo()
                server.starttls(context=context)
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USER:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())

        _update_comm_status(comm_id, "enviado", provider_meta={"provider": "smtp"})
        return {"ok": True}

    except Exception as exc:
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _update_comm_status(comm_id, "falhou", error_message=str(exc))
            return {"ok": False, "error": str(exc)}


# ── WhatsApp via Z-API ────────────────────────────────────────────────────────

@celery_app.task(name="worker.send_whatsapp_zapi", bind=True, max_retries=3, default_retry_delay=60)
def send_whatsapp_zapi(self, comm_id: str, phone: str, body: str) -> dict:
    from app.core.config import settings

    if not settings.ZAPI_INSTANCE_ID:
        _update_comm_status(comm_id, "falhou", error_message="ZAPI_INSTANCE_ID não configurado")
        return {"ok": False, "error": "Z-API not configured"}

    url = (
        f"https://api.z-api.io/instances/{settings.ZAPI_INSTANCE_ID}"
        f"/token/{settings.ZAPI_TOKEN}/send-text"
    )
    payload = {"phone": phone, "message": body}
    headers = {"Client-Token": settings.ZAPI_CLIENT_TOKEN}

    try:
        resp = httpx.post(url, json=payload, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        _update_comm_status(
            comm_id, "enviado",
            provider_meta={"provider": "zapi", "message_id": data.get("messageId")},
        )
        return {"ok": True, "data": data}

    except Exception as exc:
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _update_comm_status(comm_id, "falhou", error_message=str(exc))
            return {"ok": False, "error": str(exc)}


# ── WhatsApp via Evolution API ────────────────────────────────────────────────

@celery_app.task(name="worker.send_whatsapp_evolution", bind=True, max_retries=3, default_retry_delay=60)
def send_whatsapp_evolution(self, comm_id: str, phone: str, body: str) -> dict:
    from app.core.config import settings

    if not settings.EVOLUTION_API_URL:
        _update_comm_status(comm_id, "falhou", error_message="EVOLUTION_API_URL não configurado")
        return {"ok": False, "error": "Evolution API not configured"}

    url = f"{settings.EVOLUTION_API_URL}/message/sendText/{settings.EVOLUTION_INSTANCE}"
    payload = {"number": phone, "text": body}
    headers = {"apikey": settings.EVOLUTION_API_KEY}

    try:
        resp = httpx.post(url, json=payload, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        _update_comm_status(
            comm_id, "enviado",
            provider_meta={"provider": "evolution", "key": data.get("key")},
        )
        return {"ok": True, "data": data}

    except Exception as exc:
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _update_comm_status(comm_id, "falhou", error_message=str(exc))
            return {"ok": False, "error": str(exc)}
