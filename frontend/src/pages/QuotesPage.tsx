import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type {
  PaginatedQuotes,
  PaginatedClients,
  ProcedureTypeOption,
  QuoteStatus,
  CustaItem,
} from "@/types";
import { formatDate } from "@/lib/utils";

// ── label / style maps ────────────────────────────────────────────────────────

const statusLabel: Record<QuoteStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aguardando_assinatura: "Ag. assinatura",
  assinado: "Assinado",
  cancelado: "Cancelado",
  expirado: "Expirado",
};
const statusCls: Record<QuoteStatus, string> = {
  rascunho: "bg-gray-100 text-gray-500",
  enviado: "bg-blue-50 text-blue-700",
  aguardando_assinatura: "bg-amber-50 text-amber-700",
  assinado: "bg-green-50 text-green-700",
  cancelado: "bg-red-50 text-red-500",
  expirado: "bg-orange-50 text-orange-600",
};

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface FormState {
  client_id: string;
  procedure_id: string;
  procedure_type: string;
  honorarios_escritorio: string;
  honorarios_despachante: string;
  custas: CustaItem[];
  desconto: string;
  desconto_motivo: string;
  valid_until: string;
  notas: string;
}

const emptyForm = (): FormState => ({
  client_id: "",
  procedure_id: "",
  procedure_type: "",
  honorarios_escritorio: "",
  honorarios_despachante: "",
  custas: [],
  desconto: "0",
  desconto_motivo: "",
  valid_until: "",
  notas: "",
});

// ── Component ─────────────────────────────────────────────────────────────────

export function QuotesPage() {
  const qc = useQueryClient();
  const location = useLocation();
  const prefill = (location.state as { prefill?: { client_id: string; client_name: string; procedure_id: string; procedure_label: string } } | null)?.prefill;

  const [open, setOpen] = useState(() => !!prefill);
  const [form, setForm] = useState<FormState>(() =>
    prefill ? { ...emptyForm(), client_id: prefill.client_id, procedure_id: prefill.procedure_id } : emptyForm()
  );
  const [prefillLabel, setPrefillLabel] = useState<{ client: string; procedure: string } | null>(
    prefill ? { client: prefill.client_name, procedure: prefill.procedure_label } : null
  );
  const [clientSearch, setClientSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (prefill) {
      setForm((f) => ({ ...f, client_id: prefill.client_id, procedure_id: prefill.procedure_id }));
      setPrefillLabel({ client: prefill.client_name, procedure: prefill.procedure_label });
      setOpen(true);
    }
  }, []);

  // ── Queries ──
  const { data } = useQuery({
    queryKey: ["quotes", statusFilter],
    queryFn: async () =>
      (await api.get<PaginatedQuotes>(`/quotes?page_size=100${statusFilter ? `&status=${statusFilter}` : ""}`)).data,
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-picker-quote", clientSearch],
    queryFn: async () =>
      (await api.get<PaginatedClients>(`/clients?page_size=10&search=${encodeURIComponent(clientSearch)}`)).data,
    enabled: open,
  });

  const { data: types } = useQuery({
    queryKey: ["procedure-types"],
    queryFn: async () => (await api.get<ProcedureTypeOption[]>("/procedures/types")).data,
  });

  // ── Computed totals ──
  const custasTotal = form.custas.reduce((s, c) => s + (parseFloat(String(c.value)) || 0), 0);
  const subtotal =
    (parseFloat(form.honorarios_escritorio) || 0) +
    (parseFloat(form.honorarios_despachante) || 0) +
    custasTotal;
  const total = Math.max(0, subtotal - (parseFloat(form.desconto) || 0));

  const [formError, setFormError] = useState<string | null>(null);

  // ── Mutation ──
  const save = useMutation({
    mutationFn: async (f: FormState) => {
      if (!f.client_id) throw new Error("Selecione um cliente.");
      if (!f.procedure_type) throw new Error("Selecione o tipo de procedimento.");
      const totalHonorarios = (parseFloat(f.honorarios_escritorio) || 0) + (parseFloat(f.honorarios_despachante) || 0);
      if (totalHonorarios <= 0) throw new Error("Informe ao menos um valor de honorários maior que zero.");
      const invalidCusta = f.custas.find((c) => (c.value ?? 0) > 0 && !c.name.trim());
      if (invalidCusta) {
        throw new Error("Informe o nome de todas as custas com valor maior que zero.");
      }
      const payload = {
        client_id: f.client_id,
        procedure_id: f.procedure_id || null,
        procedure_type: f.procedure_type || null,
        honorarios_escritorio: parseFloat(f.honorarios_escritorio) || 0,
        honorarios_despachante: parseFloat(f.honorarios_despachante) || 0,
        custas_estimadas: f.custas.filter((c) => c.name && c.value),
        desconto: parseFloat(f.desconto) || 0,
        desconto_motivo: f.desconto_motivo || null,
        valid_until: f.valid_until || null,
        notas: f.notas || null,
      };
      return (await api.post("/quotes", payload)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      setOpen(false);
      setForm(emptyForm());
      setFormError(null);
    },
    onError: (err: unknown) => {
      const msg = (err as Error)?.message;
      setFormError(msg ?? "Erro ao salvar orçamento.");
    },
  });

  // ── Custas helpers ──
  const addCusta = () =>
    setForm((f) => ({ ...f, custas: [...f.custas, { name: "", value: 0 }] }));
  const removeCusta = (i: number) =>
    setForm((f) => ({ ...f, custas: f.custas.filter((_, idx) => idx !== i) }));
  const updateCusta = (i: number, field: "name" | "value", val: string) =>
    setForm((f) => {
      const custas = [...f.custas];
      custas[i] = { ...custas[i], [field]: field === "value" ? parseFloat(val) || 0 : val };
      return { ...f, custas };
    });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orçamentos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data ? `${data.total} orçamento(s)` : "Carregando..."}
          </p>
        </div>
        <button
          onClick={() => { setForm(emptyForm()); setClientSearch(""); setFormError(null); setOpen(true); }}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          Novo Orçamento
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">Todos os status</option>
          <option value="rascunho">Rascunho</option>
          <option value="enviado">Enviado</option>
          <option value="aguardando_assinatura">Ag. assinatura</option>
          <option value="assinado">Assinado</option>
          <option value="cancelado">Cancelado</option>
          <option value="expirado">Expirado</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!data ? (
          <div className="py-16 text-center text-gray-400 text-sm">Carregando...</div>
        ) : data.items.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">Nenhum orçamento encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Número</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Validade</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/orcamentos/${q.id}`}
                      className="text-primary-700 hover:text-primary-900 font-mono font-medium text-xs"
                    >
                      {q.formatted_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{q.client_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{q.procedure_type_label ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {q.valid_until ? formatDate(q.valid_until) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">
                    {fmt(q.total)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusCls[q.status]}`}>
                      {statusLabel[q.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Novo Orçamento</h2>
              <button onClick={() => { setOpen(false); setPrefillLabel(null); }} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            {prefillLabel && (
              <div className="bg-primary-50 border border-primary-100 rounded-lg px-4 py-3 mb-4">
                <p className="text-xs font-semibold text-primary-700 mb-0.5">Vinculado ao procedimento</p>
                <p className="text-sm text-gray-700">{prefillLabel.procedure}</p>
                <p className="text-xs text-gray-500 mt-0.5">Cliente: {prefillLabel.client}</p>
              </div>
            )}

            <div className="space-y-5">
              {/* Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <input
                  placeholder="Buscar cliente..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
                />
                <select
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">— selecione —</option>
                  {clients?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name} ({c.document})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de procedimento</label>
                  <select
                    value={form.procedure_type}
                    onChange={(e) => setForm({ ...form, procedure_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">— opcional —</option>
                    {types?.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Válido até</label>
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Honorários */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Composição de valores</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Honorários do escritório (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={form.honorarios_escritorio}
                      onChange={(e) => setForm({ ...form, honorarios_escritorio: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Honorários do despachante (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={form.honorarios_despachante}
                      onChange={(e) => setForm({ ...form, honorarios_despachante: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>

                {/* Custas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-600">Custas estimadas</label>
                    <button
                      onClick={addCusta}
                      className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
                    >
                      <Plus size={12} /> Adicionar custa
                    </button>
                  </div>
                  {form.custas.map((c, i) => {
                    const missingName = (c.value ?? 0) > 0 && !c.name.trim();
                    return (
                    <div key={i} className="flex gap-2 mb-2">
                      <input
                        placeholder="Descrição (ex: ITBI, CRI, INCRA)"
                        value={c.name}
                        onChange={(e) => updateCusta(i, "name", e.target.value)}
                        className={`flex-1 px-3 py-1.5 border rounded-md text-sm bg-white ${missingName ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="R$"
                        value={c.value || ""}
                        onChange={(e) => updateCusta(i, "value", e.target.value)}
                        className="w-28 px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
                      />
                      <button
                        onClick={() => removeCusta(i)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                  })}
                </div>

                {/* Desconto */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Desconto (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={form.desconto}
                      onChange={(e) => setForm({ ...form, desconto: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Motivo do desconto</label>
                    <input
                      placeholder="Ex: cliente indicado"
                      value={form.desconto_motivo}
                      onChange={(e) => setForm({ ...form, desconto_motivo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>

                {/* Resumo */}
                <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Honorários escritório</span>
                    <span>{fmt(parseFloat(form.honorarios_escritorio) || 0)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Honorários despachante</span>
                    <span>{fmt(parseFloat(form.honorarios_despachante) || 0)}</span>
                  </div>
                  {custasTotal > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Custas estimadas</span>
                      <span>{fmt(custasTotal)}</span>
                    </div>
                  )}
                  {(parseFloat(form.desconto) || 0) > 0 && (
                    <div className="flex justify-between text-red-500">
                      <span>Desconto</span>
                      <span>- {fmt(parseFloat(form.desconto) || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                    <span>Total</span>
                    <span>{fmt(total)}</span>
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {formError && (
                <p className="text-red-600 text-sm">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => save.mutate(form)}
                  disabled={save.isPending}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm"
                >
                  {save.isPending ? "Criando..." : "Criar orçamento"}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
