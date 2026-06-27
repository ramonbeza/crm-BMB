import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FolderOpen, FileCheck } from "lucide-react";
import { api } from "@/lib/api";

// ── helpers ── download blob via Axios (preserves auth headers)
async function downloadBlob(url: string, filename: string) {
  const res = await api.get(url, { responseType: "blob" });
  const href = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

// ── types ─────────────────────────────────────────────────────────────────────

interface ProcedureReport {
  total: number;
  por_tipo: { tipo: string; label: string; total: number; ativos: number; concluidos: number; cancelados: number }[];
  items: {
    id: string; numero: string; tipo_label: string; status: string;
    client_name: string | null; responsible_name: string | null;
    opened_at: string | null; deadline: string | null;
  }[];
}

interface FinancialReport {
  honorarios: {
    total_contratado: number; total_recebido: number; total_pendente: number;
    contratos: { id: string; numero: string; client_name: string | null; total: number; recebido: number; pendente: number; payment_model: string }[];
  };
  custas: { pagas: number; pendentes: number; total: number };
  repasses: { pagos: number; pendentes: number; total: number };
}

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex-1">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: max > 0 ? `${(value / max) * 100}%` : "0%" }}
      />
    </div>
  );
}

function SumCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <p className="text-xs font-medium text-current opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{fmt(value)}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

type Tab = "procedimentos" | "financeiro";

// ── Main page ─────────────────────────────────────────────────────────────────

export function RelatoriosPage() {
  const [tab, setTab] = useState<Tab>("procedimentos");
  const [filterStatus, setFilterStatus] = useState("");
  const filterTipo = "";

  const { data: procReport, isLoading: procLoading } = useQuery<ProcedureReport>({
    queryKey: ["report-procedures", filterStatus, filterTipo],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filterStatus) params.status = filterStatus;
      if (filterTipo) params.procedure_type = filterTipo;
      return (await api.get<ProcedureReport>("/reports/procedures", { params })).data;
    },
    enabled: tab === "procedimentos",
  });

  const { data: finReport, isLoading: finLoading } = useQuery<FinancialReport>({
    queryKey: ["report-financial"],
    queryFn: async () => (await api.get<FinancialReport>("/reports/financial")).data,
    enabled: tab === "financeiro",
  });

  const handleExportProcedimentos = () => {
    downloadBlob("/reports/export/procedures.xlsx", "procedimentos.xlsx");
  };
  const handleExportFinanceiro = () => {
    downloadBlob("/reports/export/financial.xlsx", "financeiro.xlsx");
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Análise de procedimentos e financeiro</p>
        </div>
        <button
          onClick={tab === "procedimentos" ? handleExportProcedimentos : handleExportFinanceiro}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
        >
          <Download size={15} />
          Exportar Excel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["procedimentos", "financeiro"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "procedimentos" ? "Procedimentos" : "Financeiro"}
          </button>
        ))}
      </div>

      {/* ── Procedimentos ── */}
      {tab === "procedimentos" && (
        <div className="space-y-5">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">Todos os status</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
            {procReport && (
              <span className="self-center text-xs text-gray-400">{procReport.total} procedimentos</span>
            )}
          </div>

          {procLoading ? (
            <p className="text-gray-400 text-sm py-8 text-center">Carregando...</p>
          ) : procReport ? (
            <>
              {/* Por tipo */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FolderOpen size={16} className="text-gray-400" />
                  <h2 className="text-sm font-bold text-gray-900">Por tipo de procedimento</h2>
                </div>
                <div className="space-y-3">
                  {procReport.por_tipo.map((t) => (
                    <div key={t.tipo}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600 truncate max-w-[200px]">{t.label}</span>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="text-blue-600 font-medium">{t.ativos} ativos</span>
                          <span className="text-green-600 font-medium">{t.concluidos} concluídos</span>
                          <span className="font-semibold text-gray-700">{t.total}</span>
                        </div>
                      </div>
                      <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-gray-100">
                        {t.total > 0 && (
                          <>
                            <div className="bg-blue-400 h-full" style={{ width: `${(t.ativos / t.total) * 100}%` }} />
                            <div className="bg-green-400 h-full" style={{ width: `${(t.concluidos / t.total) * 100}%` }} />
                            <div className="bg-gray-300 h-full" style={{ width: `${(t.cancelados / t.total) * 100}%` }} />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Protocolo</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Tipo</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Cliente</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Responsável</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Abertura</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {procReport.items.slice(0, 50).map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{p.numero}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-700 max-w-[180px] truncate">{p.tipo_label}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-600">{p.client_name ?? "—"}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{p.responsible_name ?? "—"}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">
                            {p.opened_at ? new Date(p.opened_at).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusCls[p.status] ?? ""}`}>
                              {statusLabel[p.status] ?? p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {procReport.items.length > 50 && (
                  <p className="text-xs text-gray-400 px-4 py-2 border-t border-gray-100">
                    Exibindo 50 de {procReport.items.length}. Exporte para ver todos.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── Financeiro ── */}
      {tab === "financeiro" && (
        <div className="space-y-5">
          {finLoading ? (
            <p className="text-gray-400 text-sm py-8 text-center">Carregando...</p>
          ) : finReport ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <SumCard
                  label="Total contratado"
                  value={finReport.honorarios.total_contratado}
                  color="bg-blue-50 text-blue-800"
                />
                <SumCard
                  label="Total recebido"
                  value={finReport.honorarios.total_recebido}
                  color="bg-green-50 text-green-800"
                />
                <SumCard
                  label="Pendente de recebimento"
                  value={finReport.honorarios.total_pendente}
                  color="bg-amber-50 text-amber-800"
                />
                <SumCard
                  label="Custas reais (total)"
                  value={finReport.custas.total}
                  sub={`Pagas: ${fmt(finReport.custas.pagas)} · Pendentes: ${fmt(finReport.custas.pendentes)}`}
                  color="bg-red-50 text-red-800"
                />
                <SumCard
                  label="Repasses despachante (total)"
                  value={finReport.repasses.total}
                  sub={`Pagos: ${fmt(finReport.repasses.pagos)} · Pendentes: ${fmt(finReport.repasses.pendentes)}`}
                  color="bg-purple-50 text-purple-800"
                />
              </div>

              {/* Contratos */}
              {finReport.honorarios.contratos.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                    <FileCheck size={15} className="text-gray-400" />
                    <h2 className="text-sm font-bold text-gray-900">Contratos ativos</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Contrato</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Cliente</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Recebido</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Pendente</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500">Progresso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {finReport.honorarios.contratos.map((c) => (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{c.numero}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-700">{c.client_name ?? "—"}</td>
                            <td className="px-4 py-2.5 text-xs text-right font-semibold text-gray-800">{fmt(c.total)}</td>
                            <td className="px-4 py-2.5 text-xs text-right text-green-600 font-medium">{fmt(c.recebido)}</td>
                            <td className="px-4 py-2.5 text-xs text-right text-amber-600 font-medium">{fmt(c.pendente)}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <ProgressBar
                                  value={c.recebido}
                                  max={c.total}
                                  color="bg-green-400"
                                />
                                <span className="text-xs text-gray-400 w-8 text-right">
                                  {c.total > 0 ? Math.round((c.recebido / c.total) * 100) : 0}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
