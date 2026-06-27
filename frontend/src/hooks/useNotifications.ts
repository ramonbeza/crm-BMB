import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";

// No Railway, VITE_WS_URL = "wss://backend.up.railway.app"
// Em dev local, usa o mesmo host do frontend (passa pelo nginx/proxy)
const _wsBase =
  import.meta.env.VITE_WS_URL ??
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
const WS_URL = `${_wsBase}/api/v1/notifications/ws`;

export function useNotificationsWS() {
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!accessToken) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}?token=${accessToken}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Ping keepalive every 25s
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: "ping" }));
        else clearInterval(ping);
      }, 25_000);
      (ws as WebSocket & { _ping?: ReturnType<typeof setInterval> })._ping = ping;
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg.type === "notification") {
          // Nova notificação recebida em tempo real
          qc.invalidateQueries({ queryKey: ["notifications-count"] });
          qc.invalidateQueries({ queryKey: ["notifications"] });
        }
      } catch {
        // ignora mensagens mal-formadas
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconecta após 5s
      reconnectTimer.current = setTimeout(connect, 5_000);
    };

    ws.onerror = () => ws.close();
  }, [accessToken, qc]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}
