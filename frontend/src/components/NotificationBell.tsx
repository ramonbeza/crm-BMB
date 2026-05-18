import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ExternalLink, Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  tipo: string;
  is_read: boolean;
  created_at: string;
}

interface UnreadCount {
  count: number;
}

const tipoIcon: Record<string, React.ElementType> = {
  info: Info,
  sucesso: CheckCircle2,
  aviso: AlertTriangle,
  erro: XCircle,
};

const tipoCls: Record<string, string> = {
  info: "text-blue-500",
  sucesso: "text-green-500",
  aviso: "text-amber-500",
  erro: "text-red-500",
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

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: countData } = useQuery<UnreadCount>({
    queryKey: ["notif-count"],
    queryFn: async () =>
      (await api.get<UnreadCount>("/communications/notifications/unread-count")).data,
    refetchInterval: 30_000,  // poll every 30s
  });

  const { data: notifications } = useQuery<NotificationItem[]>({
    queryKey: ["notifications"],
    queryFn: async () =>
      (await api.get<NotificationItem[]>("/communications/notifications/", {
        params: { limit: 20 },
      })).data,
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) =>
      api.post(`/communications/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-count"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAll = useMutation({
    mutationFn: async () =>
      api.post("/communications/notifications/mark-all-read"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-count"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unread = countData?.count ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md text-primary-200 hover:bg-primary-800 hover:text-white transition-colors"
        title="Notificações"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Notificações</p>
            {unread > 0 && (
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

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {!notifications || notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Bell size={24} className="mb-2 opacity-40" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = tipoIcon[n.tipo] ?? Info;
                const cls = tipoCls[n.tipo] ?? "text-blue-500";

                const content = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 cursor-pointer transition-colors ${
                      n.is_read ? "opacity-60" : "bg-blue-50/30 hover:bg-blue-50/50"
                    } hover:bg-gray-50`}
                    onClick={() => {
                      if (!n.is_read) markRead.mutate(n.id);
                      if (!n.link) setOpen(false);
                    }}
                  >
                    <Icon size={16} className={`mt-0.5 flex-shrink-0 ${cls}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-tight">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {n.link && <ExternalLink size={12} className="text-gray-300 flex-shrink-0 mt-0.5" />}
                  </div>
                );

                return n.link ? (
                  <Link
                    key={n.id}
                    to={n.link}
                    onClick={() => {
                      if (!n.is_read) markRead.mutate(n.id);
                      setOpen(false);
                    }}
                    className="block"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <Link
              to="/comunicacoes"
              onClick={() => setOpen(false)}
              className="text-xs text-primary-600 hover:text-primary-800"
            >
              Ver todas as comunicações →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
