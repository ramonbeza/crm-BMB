import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, ListTodo, Search, AlertTriangle, CalendarOff } from "lucide-react";
import { api } from "@/lib/api";
import type { WorkspaceItem, WorkspaceStage } from "@/types";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

const COLUMNS: { key: WorkspaceStage; label: string }[] = [
  { key: "novo", label: "Novo" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "aguardando", label: "Aguardando" },
  { key: "concluido", label: "Concluído" },
];

const STALE_DAYS = 21;
const DEADLINE_URGENT_DAYS = 5;

type SortKey = "updated" | "deadline" | "alpha";

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function initials(name: string | null): string {
  if (!name) return "—";
  return name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function protocolLabel(item: WorkspaceItem): string {
  return `BMB-${item.opened_at.slice(0, 4)}-${String(item.protocol_number).padStart(4, "0")}`;
}

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-400">
        <CalendarOff size={11} />
        Sem prazo
      </span>
    );
  }
  const days = daysUntil(deadline);
  const cls =
    days < 0
      ? "bg-red-100 text-red-700"
      : days <= DEADLINE_URGENT_DAYS
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

function progressColor(done: number, total: number) {
  if (total === 0) return "bg-gray-300";
  const pct = done / total;
  if (pct >= 1) return "bg-green-500";
  if (pct >= 0.5) return "bg-primary-500";
  return "bg-yellow-400";
}

function WorkspaceCard({
  item,
  showAvatar,
  onDragStart,
}: {
  item: WorkspaceItem;
  showAvatar: boolean;
  onDragStart: (id: string) => void;
}) {
  const navigate = useNavigate();
  const pct = item.stages_total > 0 ? Math.round((item.stages_done / item.stages_total) * 100) : 0;
  const deadlineDays = item.deadline ? daysUntil(item.deadline) : null;
  const urgent = deadlineDays !== null && deadlineDays <= DEADLINE_URGENT_DAYS;
  const stale = daysSince(item.updated_at) >= STALE_DAYS;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", item.id);
        onDragStart(item.id);
      }}
      onClick={() => navigate(`/procedimentos/${item.id}`)}
      className={`bg-white rounded-lg border p-3.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
        urgent ? "border-red-300" : "border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
          {protocolLabel(item)}
        </span>
        {showAvatar && (
          <div
            title={item.responsible_name ?? "Sem responsável"}
            className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          >
            {initials(item.responsible_name)}
          </div>
        )}
      </div>

      <p className="mt-2 text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
        {item.client_name ?? "—"}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{item.procedure_type_label}</p>

      <div className="flex items-center gap-2 mt-3">
        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${progressColor(item.stages_done, item.stages_total)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] text-gray-500 shrink-0">
          {item.stages_done}/{item.stages_total}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
        <DeadlineBadge deadline={item.deadline} />
        {item.pending_tasks > 0 && (
          <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
            <ListTodo size={11} />
            {item.pending_tasks}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-gray-100">
        <span className="text-[11px] text-gray-400">Atualizado {formatDate(item.updated_at)}</span>
        {stale && (
          <span
            title={`Sem movimentação há ${daysSince(item.updated_at)} dias`}
            className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium"
          >
            <AlertTriangle size={11} />
            Parado
          </span>
        )}
      </div>
    </div>
  );
}

export function WorkspacePage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [onlyMine, setOnlyMine] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("updated");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<WorkspaceStage | null>(null);

  const { data: items = [], isLoading } = useQuery<WorkspaceItem[]>({
    queryKey: ["workspace", onlyMine],
    queryFn: () =>
      api.get(`/procedures/minha-area${onlyMine ? "?only_mine=true" : ""}`).then((r) => r.data),
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: WorkspaceStage }) =>
      api.put(`/procedures/${id}`, { workspace_stage: stage }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: ["workspace", onlyMine] });
      const previous = qc.getQueryData<WorkspaceItem[]>(["workspace", onlyMine]);
      qc.setQueryData<WorkspaceItem[]>(["workspace", onlyMine], (old) =>
        (old ?? []).map((it) => (it.id === id ? { ...it, workspace_stage: stage } : it))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["workspace", onlyMine], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["workspace", onlyMine] }),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = items;
    if (term) {
      list = list.filter(
        (it) =>
          (it.client_name ?? "").toLowerCase().includes(term) ||
          protocolLabel(it).toLowerCase().includes(term) ||
          String(it.protocol_number).includes(term)
      );
    }
    const sorted = [...list];
    if (sortBy === "updated") {
      sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } else if (sortBy === "deadline") {
      sorted.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
    } else {
      sorted.sort((a, b) => (a.client_name ?? "").localeCompare(b.client_name ?? "", "pt-BR"));
    }
    return sorted;
  }, [items, search, sortBy]);

  const byColumn = useMemo(() => {
    const map: Record<WorkspaceStage, WorkspaceItem[]> = {
      novo: [], em_andamento: [], aguardando: [], concluido: [],
    };
    for (const it of filtered) {
      (map[it.workspace_stage] ?? map.novo).push(it);
    }
    return map;
  }, [filtered]);

  const showAvatar = isAdmin && !onlyMine;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Minha Área</h1>
          <p className="text-sm text-gray-500 mt-1">Procedimentos em andamento sob sua responsabilidade</p>
        </div>
        {isAdmin && (
          <div className="flex items-center bg-gray-100 rounded-lg p-1 text-sm">
            <button
              onClick={() => setOnlyMine(false)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                !onlyMine ? "bg-white shadow text-gray-900" : "text-gray-500"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setOnlyMine(true)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                onlyMine ? "bg-white shadow text-gray-900" : "text-gray-500"
              }`}
            >
              Meus procedimentos
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente ou nº do processo..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="updated">Ordenar: última atualização</option>
          <option value="deadline">Ordenar: prazo mais próximo</option>
          <option value="alpha">Ordenar: ordem alfabética</option>
        </select>
      </div>

      {isLoading && <div className="text-center py-16 text-gray-400">Carregando...</div>}

      {!isLoading && items.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 size={40} className="mx-auto mb-3 text-green-400" />
          <p className="font-medium">Nenhum procedimento ativo no momento.</p>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCol(col.key);
              }}
              onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                setDragOverCol(null);
                setDragId(null);
                if (id) moveStage.mutate({ id, stage: col.key });
              }}
              className={`rounded-xl p-2.5 min-h-[200px] transition-colors ${
                dragOverCol === col.key ? "bg-primary-50 ring-2 ring-primary-200" : "bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between px-1.5 pb-2 mb-1">
                <h2 className="text-sm font-semibold text-gray-700">{col.label}</h2>
                <span className="text-xs text-gray-400 font-medium">{byColumn[col.key].length}</span>
              </div>
              <div className="space-y-2.5">
                {byColumn[col.key].map((item) => (
                  <WorkspaceCard
                    key={item.id}
                    item={item}
                    showAvatar={showAvatar}
                    onDragStart={setDragId}
                  />
                ))}
                {byColumn[col.key].length === 0 && (
                  <p className="text-xs text-gray-300 text-center py-6">Nenhum procedimento</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
