import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellDot, CheckCheck, ExternalLink, Clock, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useNotificationsWS } from "@/hooks/useNotifications";

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  notification_type: string;
  read: boolean;
  created_at: string;
}

const typeCls: Record<string, string> = {
  deadline_alert: "border-l-orange-400",
  aviso: "border-l-orange-400",
  stage_update: "border-l-blue-400",
  procedure_assigned: "border-l-green-400",
  sucesso: "border-l-green-400",
  system: "border-l-gray-300",
  info: "border-l-blue-300",
};

const typeIcon: Record<string, typeof Clock> = {
  deadline_alert: Clock,
  system: Info,
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Conexão WebSocket para notificações em tempo real
  useNotificationsWS();

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["notifications-count"],
    queryFn: async () => (await api.get("/notifications/unread-count")).data,
    refetchInterval: 60_000,
  });

  const { data: notifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/notifications/")).data,
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAll = useMutation({
    mutationFn: async () => api.post("/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const count = countData?.count ?? 0;

  return (
    <div ref={ref} className="relative">
      {/* Sino */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md text-primary-200 hover:bg-primary-800 hover:text-white transition-colors"
        title="Notificações"
      >
        {count > 0 ? <BellDot size={18} /> : <Bell size={18} />}
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">
              Notificações {count > 0 && <span className="text-red-500">({count})</span>}
            </p>
            {count > 0 && (
              <button
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 disabled:opacity-50"
              >
                <CheckCheck size={12} />
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Bell size={28} className="mb-2 opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = typeIcon[n.notification_type] ?? Info;
                const borderCls = typeCls[n.notification_type] ?? "border-l-gray-200";

                const inner = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 border-l-4 ${borderCls} ${
                      !n.read ? "bg-blue-50/40" : "hover:bg-gray-50"
                    } transition-colors cursor-pointer`}
                    onClick={() => { if (!n.read) markRead.mutate(n.id); }}
                  >
                    <Icon size={15} className="mt-0.5 flex-shrink-0 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.read ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {n.link && <ExternalLink size={12} className="text-gray-300 mt-0.5 flex-shrink-0" />}
                  </div>
                );

                return n.link ? (
                  <Link
                    key={n.id}
                    to={n.link}
                    onClick={() => { if (!n.read) markRead.mutate(n.id); setOpen(false); }}
                    className="block"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
