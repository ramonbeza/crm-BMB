import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, ArrowRight, ListTodo } from "lucide-react";
import { api } from "@/lib/api";
import type { WorkspaceItem } from "@/types";

function progressColor(done: number, total: number) {
  if (total === 0) return "bg-gray-300";
  const pct = done / total;
  if (pct >= 1) return "bg-green-500";
  if (pct >= 0.5) return "bg-primary-500";
  return "bg-yellow-400";
}

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  const cls =
    days < 0
      ? "bg-red-100 text-red-700"
      : days <= 7
      ? "bg-orange-100 text-orange-700"
      : "bg-gray-100 text-gray-600";
  const label = days < 0 ? `${Math.abs(days)}d em atraso` : days === 0 ? "Hoje" : `${days}d restantes`;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      <Clock size={11} />
      {label}
    </span>
  );
}

export function WorkspacePage() {
  const { data: items = [], isLoading } = useQuery<WorkspaceItem[]>({
    queryKey: ["workspace"],
    queryFn: () => api.get("/procedures/minha-area").then((r) => r.data),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Minha Área</h1>
        <p className="text-sm text-gray-500 mt-1">Procedimentos em andamento sob sua responsabilidade</p>
      </div>

      {isLoading && (
        <div className="text-center py-16 text-gray-400">Carregando...</div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 size={40} className="mx-auto mb-3 text-green-400" />
          <p className="font-medium">Nenhum procedimento ativo no momento.</p>
        </div>
      )}

      <div className="grid gap-4">
        {items.map((item) => {
          const pct = item.stages_total > 0 ? Math.round((item.stages_done / item.stages_total) * 100) : 0;
          return (
            <Link
              key={item.id}
              to={`/procedimentos/${item.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-primary-300 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                      BMB-{item.opened_at.slice(0, 4)}-{String(item.protocol_number).padStart(4, "0")}
                    </span>
                    <span className="text-xs text-gray-500">{item.procedure_type_label}</span>
                    <DeadlineBadge deadline={item.deadline} />
                  </div>
                  <p className="mt-1 font-semibold text-gray-900 truncate">
                    {item.client_name ?? "—"}
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${progressColor(item.stages_done, item.stages_total)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">
                      {item.stages_done}/{item.stages_total} etapas
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {item.pending_tasks > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      <ListTodo size={11} />
                      {item.pending_tasks} tarefa{item.pending_tasks !== 1 ? "s" : ""}
                    </span>
                  )}
                  <ArrowRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors mt-1" />
                </div>
              </div>

              {item.tags.length > 0 && (
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {item.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
