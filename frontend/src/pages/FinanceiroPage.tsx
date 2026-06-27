import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  Plus,
  CheckCircle2,
  X,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  FinancialDashboard,
  FinancialEntryListItem,
  PaginatedFinancialEntries,
  EntryTipo,
  EntryCategory,
} from "@/types";

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusCls: Record<string, string> = {
  pendente: "bg-amber-50 text-amber-700 border-amber-200",
  pago: "bg-green-50 text-green-700 border-green-200",
  cancelado: "bg-gray-100 text-gray-500 border-gray-200",
};

const tipoCls: Record<string, string> = {
  custa_real: "bg-red-50 text-red-700 border-red-200",
  repasse_despachante: "bg-purple-50 text-purple-700 border-purple-200",
  honorario_recebido: "bg-blue-50 text-blue-700 border-blue-200",
};

const TIPO_OPTIONS: { value: EntryTipo; label: string }[] = [
  { value: "custa_real", label: "Custa real" },
  { value: "repasse_despachante", label: "Repasse ao despachante" },
  { value: "honorario_recebido", label: "Honorário recebido" },
];

const CATEGORY_OPTIONS: { value: EntryCategory; label: string }[] = [
  { value: "cartorio", label: "Cartório" },
  { value: "imposto", label: "Imposto" },
  { value: "taxa", label: "Taxa" },
  { value: "diligencia", label: "Diligência" },
  { value: "despachante", label: "Despachante" },
  { value: "honorario", label: "Honorário" },
  { value: "outro", label: "Outro" },
];

// ── Dashboard cards ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{fmt(value)}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Entry row ─────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  onPay,
  paying,
}: {
  entry: FinancialEntryListItem;
  onPay: (id: string) => void;
  paying: boolean;
}) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">{entry.description}</span>
          {entry.formatted_number && (
            <span className="text-xs text-gray-400 font-mono">{entry.formatted_number}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${tipoCls[entry.tipo] ?? ""}`}>
          {entry.tipo_label}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{entry.category_label}</td>
      <td className="px-4 py-3 text-sm font-semibold text-gray-900 tabular-nums">{fmt(entry.value)}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${statusCls[entry.status] ?? ""}`}>
          {entry.status_label}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {entry.due_date
          ? new Date(entry.due_date + "T00:00:00").toLocaleDateString("pt-BR")
          : "—"}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {entry.procedure_number ?? "—"}
      </td>
      <td className="px-4 py-3">
        {entry.status === "pendente" && (
          <button
            onClick={() => onPay(entry.id)}
            disabled={paying}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50"
          >
            <CheckCircle2 size={12} />
            Pagar
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Create modal ──────────────────────────────────────────────────────────────

interface CreateForm {
  tipo: EntryTipo;
  category: EntryCategory;
  description: string;
  value: string;
  status: string;
  due_date: string;
  notas: string;
}

const EMPTY_FORM: CreateForm = {
  tipo: "custa_real",
  category: "cartorio",
  description: "",
  value: "",
  status: "pendente",
  due_date: "",
  notas: "",
};

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof CreateForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () =>
      api.post("/financial", {
        tipo: form.tipo,
        category: form.category,
        description: form.description,
        value: parseFloat(form.value.replace(",", ".")) || 0,
        status: form.status,
        due_date: form.due_date || null,
        notas: form.notas || null,
      }),
    onSuccess: () => {
      onCreated();
      onClose();
    },
    onError: () => setError("Erro ao salvar o lançamento."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Novo lançamento financeiro</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
              <select
                value={form.tipo}
                onChange={(e) => set("tipo", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                {TIPO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrição *</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Ex: Emolumentos 1º cartório de imóveis"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valor (R$) *</label>
              <input
                type="text"
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                placeholder="0,00"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vencimento</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => set("due_date", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
            <textarea
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.description || !form.value}
            className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
          >
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function FinanceiroPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterTipo, setFilterTipo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [confirmPayId, setConfirmPayId] = useState<string | null>(null);

  const { data: dashboard } = useQuery<FinancialDashboard>({
    queryKey: ["financial-dashboard"],
    queryFn: async () => (await api.get<FinancialDashboard>("/financial/dashboard")).data,
  });

  const { data: list, isLoading } = useQuery<PaginatedFinancialEntries>({
    queryKey: ["financial-entries", page, filterTipo, filterStatus],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, page_size: 20 };
      if (filterTipo) params.tipo = filterTipo;
      if (filterStatus) params.status = filterStatus;
      return (await api.get<PaginatedFinancialEntries>("/financial", { params })).data;
    },
  });

  const payMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/financial/${id}/pagar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-entries"] });
      qc.invalidateQueries({ queryKey: ["financial-dashboard"] });
      setPayingId(null);
    },
  });

  const handlePay = (id: string) => {
    setConfirmPayId(id);
  };

  const confirmPay = () => {
    if (!confirmPayId) return;
    setPayingId(confirmPayId);
    payMutation.mutate(confirmPayId);
    setConfirmPayId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-sm text-gray-500 mt-0.5">Custas reais, repasses e honorários recebidos</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg"
        >
          <Plus size={16} />
          Novo lançamento
        </button>
      </div>

      {/* Dashboard cards */}
      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <SummaryCard
            label="Honorários a receber"
            value={dashboard.honorarios_a_receber}
            sub="Parcelas pendentes de contratos ativos"
            icon={TrendingUp}
            color="bg-blue-50 text-blue-600"
          />
          <SummaryCard
            label="Honorários recebidos (mês)"
            value={dashboard.honorarios_recebidos_mes}
            icon={CheckCircle2}
            color="bg-green-50 text-green-600"
          />
          <SummaryCard
            label="Custas pendentes"
            value={dashboard.custas_pendentes}
            sub="Custas reais ainda não pagas"
            icon={Clock}
            color="bg-amber-50 text-amber-600"
          />
          <SummaryCard
            label="Custas pagas (mês)"
            value={dashboard.custas_pagas_mes}
            icon={TrendingDown}
            color="bg-gray-100 text-gray-500"
          />
          <SummaryCard
            label="Repasses pendentes"
            value={dashboard.repasses_pendentes}
            sub="A pagar ao despachante"
            icon={AlertCircle}
            color="bg-purple-50 text-purple-600"
          />
          <SummaryCard
            label="Repasses pagos (mês)"
            value={dashboard.repasses_pagos_mes}
            icon={CheckCircle2}
            color="bg-purple-50 text-purple-600"
          />
        </div>
      )}

      {/* Alertas */}
      {dashboard && dashboard.em_atraso.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-red-600" />
            <p className="text-sm font-semibold text-red-700">
              {dashboard.em_atraso.length} lançamento(s) em atraso
            </p>
          </div>
          <div className="space-y-1">
            {dashboard.em_atraso.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-xs text-red-600">
                <span>{e.description}</span>
                <span className="font-semibold">{fmt(e.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dashboard && dashboard.vencimentos_proximos.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-amber-600" />
            <p className="text-sm font-semibold text-amber-700">
              {dashboard.vencimentos_proximos.length} lançamento(s) vencendo em 7 dias
            </p>
          </div>
          <div className="space-y-1">
            {dashboard.vencimentos_proximos.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-xs text-amber-700">
                <span>{e.description}</span>
                <span>
                  {e.due_date
                    ? new Date(e.due_date + "T00:00:00").toLocaleDateString("pt-BR")
                    : "—"}{" "}
                  — <strong>{fmt(e.value)}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters + table */}
      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <Filter size={14} className="text-gray-400" />
          <select
            value={filterTipo}
            onChange={(e) => { setFilterTipo(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">Todos os tipos</option>
            {TIPO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="cancelado">Cancelado</option>
          </select>

          {list && (
            <span className="ml-auto text-xs text-gray-400">{list.total} registros</span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-gray-400 text-sm">Carregando...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Descrição</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Categoria</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Vencimento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Procedimento</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {list?.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-400 text-sm">
                      Nenhum lançamento encontrado.
                    </td>
                  </tr>
                ) : (
                  list?.items.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      onPay={handlePay}
                      paying={payingId === e.id && payMutation.isPending}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {list && list.pages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
            >
              ← Anterior
            </button>
            <span className="text-xs text-gray-400">
              Página {page} de {list.pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(list.pages, p + 1))}
              disabled={page === list.pages}
              className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>

      {confirmPayId && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <p className="text-base font-semibold text-gray-900 mb-4">Confirmar pagamento?</p>
            <p className="text-sm text-gray-500 mb-6">Esta ação marcará o lançamento como pago.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmPayId(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPay}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["financial-entries"] });
            qc.invalidateQueries({ queryKey: ["financial-dashboard"] });
          }}
        />
      )}
    </div>
  );
}
