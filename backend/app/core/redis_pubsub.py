"""
Redis Pub/Sub bridge — Celery → WebSocket.

Celery workers não compartilham memória com o processo FastAPI.
Usamos Redis como canal intermediário:
  - Celery publica em  "notif:{user_id}"
  - FastAPI subscreve e entrega via WebSocket

Uso no Celery (síncrono):
    from app.core.redis_pubsub import publish_notification_sync
    publish_notification_sync(user_id, {"title": "...", "count": 1})

Uso no FastAPI (na startup):
    asyncio.create_task(start_pubsub_listener())
"""
from __future__ import annotations

import asyncio
import json
import logging
import os

logger = logging.getLogger(__name__)

CHANNEL_PREFIX = "notif:"


# ── Publicação síncrona (Celery worker) ──────────────────────────────────────

def publish_notification_sync(user_id: str, data: dict) -> None:
    """Publica mensagem no canal Redis do usuário (chamado do Celery)."""
    import redis as sync_redis
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    r = sync_redis.from_url(redis_url, decode_responses=True)
    try:
        r.publish(f"{CHANNEL_PREFIX}{user_id}", json.dumps(data))
    finally:
        r.close()


# ── Listener assíncrono (FastAPI) ────────────────────────────────────────────

async def start_pubsub_listener() -> None:
    """
    Background task que subscreve a todos os canais 'notif:*' no Redis
    e encaminha mensagens para os WebSocket clients conectados.
    Executado uma vez no startup do FastAPI.
    """
    from app.core.ws_manager import ws_manager

    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    try:
        import redis.asyncio as aioredis
    except ImportError:
        logger.warning("redis.asyncio não disponível — push WS via pub/sub desabilitado")
        return

    while True:
        try:
            client = aioredis.from_url(redis_url, decode_responses=True)
            pubsub = client.pubsub()
            await pubsub.psubscribe(f"{CHANNEL_PREFIX}*")  # padrão glob
            logger.info("Redis pub/sub listener iniciado em '%s*'", CHANNEL_PREFIX)

            async for message in pubsub.listen():
                if message["type"] not in ("pmessage", "message"):
                    continue
                try:
                    channel: str = message.get("channel", "")
                    if not channel.startswith(CHANNEL_PREFIX):
                        continue
                    user_id = channel[len(CHANNEL_PREFIX):]
                    payload = json.loads(message["data"])
                    await ws_manager.send_to_user(user_id, {"type": "notification", **payload})
                except Exception as exc:
                    logger.warning("Erro ao processar mensagem pub/sub: %s", exc)

        except asyncio.CancelledError:
            logger.info("Redis pub/sub listener cancelado")
            return
        except Exception as exc:
            logger.warning("Redis pub/sub desconectado (%s) — reconectando em 5s...", exc)
            await asyncio.sleep(5)
