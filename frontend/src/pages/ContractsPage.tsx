import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AlertCircle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import type {
  Contract,
  ContractStatus,
  PaginatedContracts,
  InstallmentItem,
  PaymentModel,
} from "@/types";
import { formatDate } from "@/lib/utils";
import { D4SignPanel } from "@/components/D4SignPanel";

// ── maps ──────────────────────────────────────────────────────────────────────

const statusLabel: Record<ContractStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aguardando_assinatura: "Ag. assinatura",
  assinado: "Assinado",
  cancelado: "Cancelado",
};
const statusCls: Record<ContractStatus, string> = {
  rascunho: "bg-gray-100 text-gray-600",
  enviado: "bg-blue-50 text-blue-700",
  aguardando_assinatura: "bg-amber-50 text-amber-700",
  assinado: "bg-green-50 text-green-700",
  cancelado: "bg-red-50 text-red-600",
};

const STATUS_FLOW: ContractStatus[] = [
  "rascunho",
  "enviado",
  "aguardando_assinatura",
  "assinado",
];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ── ContractsList ──────────────────────────────────────────────────────────────

export function ContractsPage() {
  const [statusFilter, setStatusFilter] = useState("");

  const { data } = useQuery({
    queryKey: ["contracts", statusFilter],
    queryFn: async () =>
      (await api.get<PaginatedContracts>(`/quotes/contratos/?page_size=100${statusFilter ? `&status=${statusFilter}` : ""}`)).data,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos de Honorários</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data ? `${data.total} contrato(s)` : "Carregando..."}
          </p>
        </div>
      </div>

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
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!data ? (
          <div className="py-16 text-center text-gray-400 text-sm">Carregando...</div>
        ) : data.items.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            Nenhum contrato encontrado.
            <br />
            <span className="text-xs">Contratos são gerados a partir de orçamentos assinados.</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Número</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Modelo</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Valor total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/contratos/${c.id}`}
                      className="text-primary-700 hover:text-primary-900 font-mono font-medium text-xs"
                    >
                      {c.formatted_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.client_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.payment_model_label}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(c.total_value)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusCls[c.status]}`}>
                      {statusLabel[c.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── ContractDetailPage ────────────────────────────────────────────────────────

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editingInstallments, setEditingInstallments] = useState(false);
  const [installments, setInstallments] = useState<InstallmentItem[]>([]);

  const { data: c, isLoading } = useQuery<Contract>({
    queryKey: ["contract", id],
    queryFn: async () => (await api.get<Contract>(`/quotes/contratos/${id}`)).data,
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: async (newStatus: ContractStatus) =>
      (await api.put(`/quotes/contratos/${id}`, { status: newStatus })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract", id] }),
  });

  const updatePayment = useMutation({
    mutationFn: async (data: { payment_model?: PaymentModel; total_value?: number; installments?: InstallmentItem[] }) =>
      (await api.put(`/quotes/contratos/${id}`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract", id] });
      setEditingInstallments(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    );
  }

  if (!c) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="text-red-400" size={32} />
        <p className="text-gray-500 text-sm">Contrato não encontrado.</p>
        <Link to="/contratos" className="text-primary-600 text-sm hover:underline">← Voltar</Link>
      </div>
    );
  }

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(c.status) + 1] as ContractStatus | undefined;
  const canAdvance = c.status !== "assinado" && c.status !== "cancelado";

  const paidTotal = c.installments.filter((i) => i.status === "pago").reduce((s, i) => s + i.value, 0);
  const pendingTotal = c.installments.filter((i) => i.status === "pendente").reduce((s, i) => s + i.value, 0);

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/contratos"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5"
      >
        <ArrowLeft size={16} />
        Contratos
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 font-mono">{c.formatted_number}</h1>
              <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${statusCls[c.status]}`}>
                {statusLabel[c.status]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{c.client_name ?? "—"}</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {nextStatus && canAdvance && (
              <button
                onClick={() => updateStatus.mutate(nextStatus)}
                disabled={updateStatus.isPending}
                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-md disabled:opacity-50"
              >
                Avançar → {statusLabel[nextStatus]}
              </button>
            )}
            {canAdvance && c.status !== "rascunho" && (
              <button
                onClick={() => updateStatus.mutate("cancelado")}
                disabled={updateStatus.isPending}
                className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-md hover:bg-red-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <div>
            <p className="text-xs font-medium text-gray-500">Modelo de pagamento</p>
            <p className="text-gray-800 mt-0.5">{c.payment_model_label}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Valor total</p>
            <p className="text-gray-900 font-bold mt-0.5">{fmt(c.total_value)}</p>
          </div>
          {c.exito_percentual != null && (
            <div>
              <p className="text-xs font-medium text-gray-500">Percentual de êxito</p>
              <p className="text-gray-800 mt-0.5">{c.exito_percentual}%</p>
            </div>
          )}
          {c.signed_at && (
            <div>
              <p className="text-xs font-medium text-gray-500">Assinado em</p>
              <p className="text-gray-800 mt-0.5">{new Date(c.signed_at).toLocaleDateString("pt-BR")}</p>
            </div>
          )}
          {c.quote_id && (
            <div>
              <p className="text-xs font-medium text-gray-500">Orçamento origem</p>
              <Link to={`/orcamentos/${c.quote_id}`} className="text-primary-600 text-sm hover:underline block mt-0.5">
                Ver orçamento →
              </Link>
            </div>
          )}
          {c.procedure_id && (
            <div>
              <p className="text-xs font-medium text-gray-500">Procedimento</p>
              <Link to={`/procedimentos/${c.procedure_id}`} className="text-primary-600 text-sm hover:underline block mt-0.5">
                Ver procedimento →
              </Link>
            </div>
          )}
        </div>

        {c.notas && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1">Observações</p>
            <p className="text-sm text-gray-700">{c.notas}</p>
          </div>
        )}
      </div>

      {/* Installments */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Parcelas / Pagamentos</h2>
          <button
            onClick={() => {
              setInstallments(c.installments.map((i) => ({ ...i })));
              setEditingInstallments(true);
            }}
            className="text-xs text-primary-600 hover:text-primary-800"
          >
            {c.installments.length === 0 ? "Adicionar parcelas" : "Editar parcelas"}
          </button>
        </div>

        {c.installments.length === 0 && !editingInstallments ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Nenhuma parcela cadastrada.
          </p>
        ) : !editingInstallments ? (
          <>
            <div className="space-y-2 mb-4">
              {c.installments.map((inst, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                    inst.status === "pago"
                      ? "border-green-200 bg-green-50/40"
                      : "border-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                    <span className="text-sm text-gray-700">{formatDate(inst.due_date)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">{fmt(inst.value)}</span>
                    <button
                      onClick={() => {
                        const updated = c.installments.map((p, idx) =>
                          idx === i ? { ...p, status: p.status === "pago" ? "pendente" : "pago" } : p
                        ) as InstallmentItem[];
                        updatePayment.mutate({ installments: updated });
                      }}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium border cursor-pointer ${
                        inst.status === "pago"
                          ? "bg-green-50 text-green-600 border-green-200"
                          : "bg-gray-50 text-gray-500 border-gray-200"
                      }`}
                    >
                      {inst.status === "pago" ? "Pago ✓" : "Pendente"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {c.installments.length > 0 && (
              <div className="border-t border-gray-100 pt-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-500">
                  <span>Pago</span>
                  <span className="text-green-600 font-medium">{fmt(paidTotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Pendente</span>
                  <span>{fmt(pendingTotal)}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <InstallmentEditor
            installments={installments}
            totalValue={c.total_value}
            onChange={setInstallments}
            onSave={() => updatePayment.mutate({ installments })}
            onCancel={() => setEditingInstallments(false)}
            saving={updatePayment.isPending}
          />
        )}
      </div>

      {/* D4Sign */}
      <D4SignPanel
        entityType="contracts"
        entityId={c.id}
        entityStatus={c.status}
        onSigned={() => qc.invalidateQueries({ queryKey: ["contract", id] })}
      />
    </div>
  );
}

// ── InstallmentEditor ──────────────────────────────────────────────────────────

function InstallmentEditor({
  installments,
  totalValue,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  installments: InstallmentItem[];
  totalValue: number;
  onChange: (items: InstallmentItem[]) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const add = () =>
    onChange([...installments, { due_date: "", value: 0, status: "pendente" }]);
  const remove = (i: number) => onChange(installments.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof InstallmentItem, val: string) =>
    onChange(
      installments.map((item, idx) =>
        idx === i ? { ...item, [field]: field === "value" ? parseFloat(val) || 0 : val } : item
      )
    );

  const total = installments.reduce((s, i) => s + i.value, 0);
  const diff = totalValue - total;

  return (
    <div className="space-y-2">
      {installments.map((inst, i) => (
        <div key={i} className="flex gap-2 items-center">
          <span className="text-xs text-gray-400 w-4">{i + 1}</span>
          <input
            type="date"
            value={inst.due_date}
            onChange={(e) => update(i, "due_date", e.target.value)}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={inst.value || ""}
            onChange={(e) => update(i, "value", e.target.value)}
            className="w-32 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
            placeholder="R$"
          />
          <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <button
        onClick={add}
        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 mt-1"
      >
        <Plus size={12} /> Adicionar parcela
      </button>

      {diff !== 0 && (
        <p className={`text-xs mt-1 ${Math.abs(diff) < 0.01 ? "text-green-600" : "text-amber-600"}`}>
          {diff > 0 ? `Faltam ${fmt(diff)} para atingir o total` : `Excede o total em ${fmt(Math.abs(diff))}`}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-md disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar parcelas"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 border border-gray-200 text-xs text-gray-600 rounded-md hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
