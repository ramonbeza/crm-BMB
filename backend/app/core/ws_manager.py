"""
WebSocket Connection Manager — mantém conexões ativas por user_id.
Thread-safe para uso com asyncio (uvicorn single-thread por worker).
"""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        # user_id → lista de websockets (múltiplas abas/dispositivos)
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: UUID) -> None:
        await websocket.accept()
        uid = str(user_id)
        self._connections.setdefault(uid, []).append(websocket)
        logger.info("WS connected: user=%s total=%d", uid, len(self._connections[uid]))

    def disconnect(self, websocket: WebSocket, user_id: UUID) -> None:
        uid = str(user_id)
        conns = self._connections.get(uid, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self._connections.pop(uid, None)
        logger.info("WS disconnected: user=%s", uid)

    async def send_to_user(self, user_id: UUID | str, data: dict) -> None:
        """Envia JSON para todas as conexões abertas de um usuário."""
        uid = str(user_id)
        for ws in list(self._connections.get(uid, [])):
            try:
                await ws.send_json(data)
            except Exception:
                # Conexão morreu — será removida no próximo disconnect
                pass

    async def broadcast(self, data: dict) -> None:
        """Envia para todos os usuários conectados."""
        for uid in list(self._connections.keys()):
            await self.send_to_user(uid, data)

    @property
    def connected_user_ids(self) -> list[str]:
        return list(self._connections.keys())


# Instância singleton — compartilhada entre rotas
ws_manager = ConnectionManager()
