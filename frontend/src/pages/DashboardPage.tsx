import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users,
  FolderOpen,
  FileCheck,
  Receipt,
  TrendingUp,
  Clock,
  AlertTriangle,
  Calendar,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";

// ── types ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  clientes: { total: number; novos_mes: number };
  procedimentos: {
    total: number;
    ativos: number;
    concluidos_mes: number;
    por_status: Record<string, number>;
    por_tipo: { tipo: string; label: string; total: number }[];
  };
  orcamentos: { assinados: number };
  contratos: { ativos: number };
  financeiro: {
    honorarios_a_receber: number;
    honorarios_recebidos_mes: number;
    custas_pendentes: number;
    repasses_pendentes: number;
  };
  reunioes_hoje: number;
  prazos: {
    proximos: DeadlineItem[];
    em_atraso: DeadlineItem[];
  };
  atividade_recente: RecentItem[];
}

interface DeadlineItem {
  stage_id: string;
  stage_name: string;
  due_date: string | null;
  days_left: number | null;
  procedure_id: string;
  procedure_number: string;
  client_name: string | null;
}

interface RecentItem {
  id: string;
  numero: string;
  tipo_label: string;
  status: string;
  client_name: string | null;
  updated_at: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusCls: Record<string, string> = {
  em_andamento: "bg-blue-50 text-blue-700",
  concluido: "bg-green-50 text-green-700",
  cancelado: "bg-gray-100 text-gray-500",
};
const statusLabel: Record<string, string> = {
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  to,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  to?: string;
}) {
  const inner = (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

function MiniBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-36 truncate shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-5 text-right">{value}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard-kpis"],
    queryFn: async () => (await api.get<DashboardData>("/reports/dashboard")).data,
    refetchInterval: 60_000,
  });

  const roleLabel: Record<string, string> = {
    admin: "Administrador",
    advogado: "Advogado(a)",
    estagiario: "Estagiário(a)",
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Carregando dashboard...</p>
      </div>
    );
  }

  const maxTipo = Math.max(...(data.procedimentos.por_tipo.map((t) => t.total) || [1]), 1);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Bom dia, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {roleLabel[user?.role ?? ""] ?? user?.role} ·{" "}
          {new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Clientes ativos"
          value={data.clientes.total}
          sub={`+${data.clientes.novos_mes} este mês`}
          icon={Users}
          color="bg-blue-50 text-blue-600"
          to="/clientes"
        />
        <KpiCard
          label="Procedimentos ativos"
          value={data.procedimentos.ativos}
          sub={`${data.procedimentos.concluidos_mes} concluídos este mês`}
          icon={FolderOpen}
          color="bg-indigo-50 text-indigo-600"
          to="/procedimentos"
        />
        <KpiCard
          label="Contratos assinados"
          value={data.contratos.ativos}
          icon={FileCheck}
          color="bg-green-50 text-green-600"
          to="/contratos"
        />
        <KpiCard
          label="Reuniões hoje"
          value={data.reunioes_hoje}
          icon={Calendar}
          color="bg-purple-50 text-purple-600"
          to="/agenda"
        />
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Honorários a receber"
          value={fmt(data.financeiro.honorarios_a_receber)}
          sub="Parcelas pendentes"
          icon={TrendingUp}
          color="bg-emerald-50 text-emerald-600"
          to="/financeiro"
        />
        <KpiCard
          label="Recebido este mês"
          value={fmt(data.financeiro.honorarios_recebidos_mes)}
          icon={DollarSign}
          color="bg-emerald-100 text-emerald-700"
          to="/financeiro"
        />
        <KpiCard
          label="Custas pendentes"
          value={fmt(data.financeiro.custas_pendentes)}
          icon={Receipt}
          color="bg-amber-50 text-amber-600"
          to="/financeiro"
        />
        <KpiCard
          label="Repasses pendentes"
          value={fmt(data.financeiro.repasses_pendentes)}
          icon={DollarSign}
          color="bg-purple-50 text-purple-600"
          to="/financeiro"
        />
      </div>

      {/* Alerts + Prazo row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Em atraso */}
        {data.prazos.em_atraso.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-600" />
              <p className="text-sm font-semibold text-red-700">
                {data.prazos.em_atraso.length} etapa(s) em atraso
              </p>
              <Link to="/prazos" className="ml-auto text-xs text-red-500 hover:text-red-700">
                Ver todos →
              </Link>
            </div>
            <div className="space-y-2">
              {data.prazos.em_atraso.slice(0, 4).map((d) => (
                <Link
                  key={d.stage_id}
                  to={`/procedimentos/${d.procedure_id}`}
                  className="flex items-center justify-between text-xs text-red-700 hover:text-red-900 group"
                >
                  <span className="truncate">
                    <span className="font-mono mr-1">{d.procedure_number}</span>
                    · {d.stage_name}
                  </span>
                  <span className="font-semibold ml-2 flex-shrink-0 group-hover:underline">
                    {d.days_left !== null ? `${Math.abs(d.days_left)}d atraso` : ""}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Próximos 7 dias */}
        {data.prazos.proximos.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-amber-600" />
              <p className="text-sm font-semibold text-amber-700">
                {data.prazos.proximos.length} prazo(s) nos próximos 7 dias
              </p>
              <Link to="/prazos" className="ml-auto text-xs text-amber-500 hover:text-amber-700">
                Ver todos →
              </Link>
            </div>
            <div className="space-y-2">
              {data.prazos.proximos.slice(0, 4).map((d) => (
                <Link
                  key={d.stage_id}
                  to={`/procedimentos/${d.procedure_id}`}
                  className="flex items-center justify-between text-xs text-amber-700 hover:text-amber-900 group"
                >
                  <span className="truncate">
                    <span className="font-mono mr-1">{d.procedure_number}</span>
                    · {d.stage_name}
                  </span>
                  <span className="ml-2 flex-shrink-0">
                    {d.days_left === 0
                      ? "hoje"
                      : d.days_left === 1
                      ? "amanhã"
                      : `em ${d.days_left}d`}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom row: by type + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Procedimentos por tipo */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Procedimentos por tipo</h2>
            <Link to="/relatorios" className="text-xs text-primary-600 hover:underline">
              Relatórios →
            </Link>
          </div>
          {data.procedimentos.por_tipo.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sem procedimentos.</p>
          ) : (
            <div className="space-y-3">
              {data.procedimentos.por_tipo.map((t) => (
                <MiniBar
                  key={t.tipo}
                  label={t.label}
                  value={t.total}
                  max={maxTipo}
                  color="bg-primary-500"
                />
              ))}
            </div>
          )}
        </div>

        {/* Atividade recente */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Atividade recente</h2>
            <Link to="/procedimentos" className="text-xs text-primary-600 hover:underline">
              Ver todos →
            </Link>
          </div>
          {data.atividade_recente.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nenhum procedimento.</p>
          ) : (
            <div className="space-y-1">
              {data.atividade_recente.map((p) => (
                <Link
                  key={p.id}
                  to={`/procedimentos/${p.id}`}
                  className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded-lg px-2 -mx-2 group"
                >
                  <span className="font-mono text-xs text-gray-500 w-28 flex-shrink-0">
                    {p.numero}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 truncate">{p.tipo_label}</p>
                    <p className="text-xs text-gray-400 truncate">{p.client_name ?? "—"}</p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${statusCls[p.status] ?? ""}`}>
                    {statusLabel[p.status] ?? p.status}
                  </span>
                  <span className="text-xs text-gray-300 flex-shrink-0 group-hover:text-gray-400">
                    {timeAgo(p.updated_at)}
                  </span>
                  <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
