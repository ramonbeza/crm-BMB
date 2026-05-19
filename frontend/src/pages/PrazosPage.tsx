import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Clock, AlertTriangle, DollarSign, FolderOpen, Calendar } from "lucide-react";
import { api } from "@/lib/api";

interface DeadlineData {
  days_ahead: number;
  proximos: DeadlineItem[];
  em_atraso: AtrasoItem[];
  totais: { proximos: number; em_atraso: number; urgentes: number };
}

interface DeadlineItem {
  tipo: string;
  subtipo?: string;
  id: string;
  descricao: string;
  valor?: number;
  due_date: string | null;
  days_left: number | null;
  urgente: boolean;
  procedure_id: string | null;
  procedure_number?: string;
  client_name?: string | null;
}

interface AtrasoItem {
  tipo: string;
  id: string;
  descricao: string;
  due_date: string | null;
  days_late: number | null;
  procedure_id: string;
  procedure_number: string;
  client_name: string | null;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function DaysChip({ days }: { days: number | null }) {
  if (days === null) return null;
  if (days === 0) return <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Hoje</span>;
  if (days === 1) return <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Amanhã</span>;
  if (days <= 3) return <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Em {days}d</span>;
  if (days <= 7) return <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Em {days}d</span>;
  return <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Em {days}d</span>;
}

function DeadlineRow({ item }: { item: DeadlineItem }) {
  const isFinanceiro = item.tipo === "financeiro";
  const Icon = isFinanceiro ? DollarSign : FolderOpen;

  return (
    <div className={`flex items-start gap-4 px-4 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 ${item.urgente ? "bg-orange-50/30" : ""}`}>
      <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${isFinanceiro ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.descricao}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {item.procedure_number && (
            <Link
              to={`/procedimentos/${item.procedure_id}`}
              className="text-xs font-mono text-primary-600 hover:underline"
            >
              {item.procedure_number}
            </Link>
          )}
          {item.client_name && (
            <span className="text-xs text-gray-400">· {item.client_name}</span>
          )}
          {item.valor !== undefined && (
            <span className="text-xs font-semibold text-gray-600">{fmt(item.valor)}</span>
          )}
          {item.due_date && (
            <span className="text-xs text-gray-400">
              {new Date(item.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>
      </div>
      <DaysChip days={item.days_left} />
    </div>
  );
}

function AtrasoRow({ item }: { item: AtrasoItem }) {
  return (
    <div className="flex items-start gap-4 px-4 py-3.5 border-b border-gray-50 last:border-0 hover:bg-red-50/30">
      <div className="p-1.5 rounded-lg bg-red-50 text-red-600 flex-shrink-0 mt-0.5">
        <AlertTriangle size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-800 truncate">{item.descricao}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Link
            to={`/procedimentos/${item.procedure_id}`}
            className="text-xs font-mono text-red-500 hover:underline"
          >
            {item.procedure_number}
          </Link>
          {item.client_name && (
            <span className="text-xs text-red-400">· {item.client_name}</span>
          )}
          {item.due_date && (
            <span className="text-xs text-red-400">
              {new Date(item.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>
      </div>
      {item.days_late !== null && (
        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex-shrink-0">
          {item.days_late}d atraso
        </span>
      )}
    </div>
  );
}

export function PrazosPage() {
  const [daysAhead, setDaysAhead] = useState(30);

  const { data, isLoading } = useQuery<DeadlineData>({
    queryKey: ["deadlines", daysAhead],
    queryFn: async () =>
      (await api.get<DeadlineData>("/reports/deadlines", { params: { days_ahead: daysAhead } })).data,
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestão de Prazos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Etapas de procedimentos e vencimentos financeiros</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-400" />
          <span className="text-xs text-gray-500">Período:</span>
          <select
            value={daysAhead}
            onChange={(e) => setDaysAhead(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value={7}>7 dias</option>
            <option value={15}>15 dias</option>
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
            <option value={90}>90 dias</option>
          </select>
        </div>
      </div>

      {/* Summary chips */}
      {data && (
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
            <AlertTriangle size={14} className="text-red-600" />
            <span className="text-sm font-semibold text-red-700">{data.totais.em_atraso} em atraso</span>
          </div>
          <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg">
            <Clock size={14} className="text-orange-600" />
            <span className="text-sm font-semibold text-orange-700">{data.totais.urgentes} urgentes (≤3d)</span>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            <Calendar size={14} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">{data.totais.proximos} em {daysAhead}d</span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Carregando prazos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Em atraso */}
          <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
              <AlertTriangle size={15} className="text-red-600" />
              <h2 className="text-sm font-bold text-red-800">Em atraso</h2>
              <span className="ml-auto text-xs text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
                {data?.em_atraso.length ?? 0}
              </span>
            </div>
            {!data?.em_atraso.length ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum prazo em atraso. ✓</p>
            ) : (
              data.em_atraso.map((item) => <AtrasoRow key={item.id} item={item} />)
            )}
          </div>

          {/* Próximos */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Clock size={15} className="text-amber-600" />
              <h2 className="text-sm font-bold text-gray-900">Próximos {daysAhead} dias</h2>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {data?.proximos.length ?? 0}
              </span>
            </div>
            {!data?.proximos.length ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum prazo no período.</p>
            ) : (
              data.proximos.map((item) => <DeadlineRow key={item.id} item={item} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
