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


# ── WhatsApp via Evolution API ─────────────────────────────────────────────────

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


# ── Geração de documentos com Claude API ─────────────────────────────────────

def _update_ai_doc(doc_id: str, **fields) -> None:
    """Atualiza um AIDocument diretamente via psycopg2 (síncrono)."""
    import os
    import psycopg2

    dsn = os.environ.get("DATABASE_URL_SYNC", "")
    if not dsn:
        return

    set_clauses = ["updated_at = now()"]
    params: list = []
    for k, v in fields.items():
        set_clauses.append(f"{k} = %s")
        params.append(v)

    params.append(doc_id)
    sql = f"UPDATE ai_documents SET {', '.join(set_clauses)} WHERE id = %s"
    try:
        conn = psycopg2.connect(dsn)
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
        conn.close()
    except Exception:
        pass


@celery_app.task(name="worker.generate_ai_document", bind=True, max_retries=2, default_retry_delay=30)
def generate_ai_document(self, doc_id: str, doc_type: str, context: dict) -> dict:
    """Gera um documento jurídico usando a Claude API e salva no banco."""
    from app.core.config import settings
    from app.worker.ai_prompts import SYSTEM_PROMPT, build_prompt

    if not settings.ANTHROPIC_API_KEY:
        _update_ai_doc(doc_id, status="falhou", error_message="ANTHROPIC_API_KEY não configurado")
        return {"ok": False, "error": "API key not configured"}

    _update_ai_doc(doc_id, status="gerando")

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=120.0)
        user_prompt = build_prompt(doc_type, context)

        message = client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        content = message.content[0].text if message.content else ""
        tokens_in = message.usage.input_tokens
        tokens_out = message.usage.output_tokens

        _update_ai_doc(
            doc_id,
            status="concluido",
            content=content,
            model_used=settings.CLAUDE_MODEL,
            tokens_input=tokens_in,
            tokens_output=tokens_out,
            prompt_used=user_prompt,
        )
        return {"ok": True, "tokens_in": tokens_in, "tokens_out": tokens_out}

    except Exception as exc:
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _update_ai_doc(doc_id, status="falhou", error_message=str(exc))
            return {"ok": False, "error": str(exc)}


# ── Alertas de prazo (executado pelo Celery Beat) ─────────────────────────────

@celery_app.task(name="worker.check_deadlines")
def check_deadlines() -> dict:
    """
    Verifica procedimentos com prazo nos próximos 7 dias e cria notificações.
    Deve ser agendado diariamente (ex: 08h00).
    Execução síncrona com psycopg2.
    """
    import os
    from datetime import date, timedelta

    import psycopg2
    import psycopg2.extras

    db_url = os.environ["DATABASE_URL_SYNC"]
    today = date.today()
    alert_days = [1, 3, 7]

    created = 0
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            for days in alert_days:
                target = today + timedelta(days=days)

                # Busca procedimentos com prazo = target e status em_andamento
                cur.execute(
                    """
                    SELECT p.id, p.protocol_number, p.deadline,
                           p.responsible_user_id, p.executor_user_id,
                           c.pf_data_name, c.pj_data_name
                    FROM procedures p
                    LEFT JOIN (
                        SELECT c.id,
                               pf.name as pf_data_name,
                               pj.company_name as pj_data_name
                        FROM clients c
                        LEFT JOIN clients_pf pf ON pf.client_id = c.id
                        LEFT JOIN clients_pj pj ON pj.client_id = c.id
                    ) c ON c.id = p.client_id
                    WHERE p.deadline = %s AND p.status = 'em_andamento'
                    """,
                    (target,),
                )
                procedures = cur.fetchall()

                for proc in procedures:
                    proc_id = str(proc["id"])
                    proto = proc["protocol_number"]
                    client_name = proc["pf_data_name"] or proc["pj_data_name"] or "—"
                    days_label = f"{days} dia{'s' if days > 1 else ''}"
                    title = f"⚠️ Prazo em {days_label}: BMB-{target.year}-{proto:04d}"
                    body = f"Procedimento de {client_name} vence em {days_label} ({target.strftime('%d/%m/%Y')})."
                    link = f"/procedimentos/{proc_id}"

                    # Notifica responsável interno e executor (despachante)
                    notify_users = set()
                    if proc["responsible_user_id"]:
                        notify_users.add(str(proc["responsible_user_id"]))
                    if proc["executor_user_id"]:
                        notify_users.add(str(proc["executor_user_id"]))

                    for user_id in notify_users:
                        # Evita duplicata: não cria se já existe notif do mesmo proc no mesmo dia
                        cur.execute(
                            """
                            SELECT 1 FROM notifications
                            WHERE recipient_id = %s AND link = %s
                              AND created_at::date = %s
                            """,
                            (user_id, link, today),
                        )
                        if cur.fetchone():
                            continue

                        cur.execute(
                            """
                            INSERT INTO notifications
                              (id, recipient_id, title, body, tipo, link,
                               is_read, created_at, updated_at)
                            VALUES
                              (gen_random_uuid(), %s, %s, %s, 'aviso', %s,
                               false, now(), now())
                            """,
                            (user_id, title, body, link),
                        )
                        created += 1

                        # Push em tempo real via Redis pub/sub → WebSocket
                        try:
                            from app.core.redis_pubsub import publish_notification_sync
                            publish_notification_sync(
                                user_id,
                                {"title": title, "body": body, "link": link},
                            )
                        except Exception:
                            pass  # Falha no push não bloqueia a criação da notificação

            conn.commit()
    finally:
        conn.close()

    return {"created": created, "checked_days": alert_days}
