import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AlertCircle, FileText, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { Quote, QuoteStatus } from "@/types";
import { formatDate } from "@/lib/utils";
import { D4SignPanel } from "@/components/D4SignPanel";

// ── maps ──────────────────────────────────────────────────────────────────────

const STATUS_FLOW: QuoteStatus[] = [
  "rascunho",
  "enviado",
  "aguardando_assinatura",
  "assinado",
];

const statusLabel: Record<QuoteStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aguardando_assinatura: "Ag. assinatura",
  assinado: "Assinado",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

const statusCls: Record<QuoteStatus, string> = {
  rascunho: "bg-gray-100 text-gray-600 border-gray-200",
  enviado: "bg-blue-50 text-blue-700 border-blue-200",
  aguardando_assinatura: "bg-amber-50 text-amber-700 border-amber-200",
  assinado: "bg-green-50 text-green-700 border-green-200",
  cancelado: "bg-red-50 text-red-600 border-red-200",
  expirado: "bg-orange-50 text-orange-600 border-orange-200",
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ── Component ─────────────────────────────────────────────────────────────────

export function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: q, isLoading } = useQuery<Quote>({
    queryKey: ["quote", id],
    queryFn: async () => (await api.get<Quote>(`/quotes/${id}`)).data,
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: async (newStatus: QuoteStatus) =>
      (await api.put(`/quotes/${id}`, { status: newStatus })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quote", id] }),
  });

  const newVersion = useMutation({
    mutationFn: async () =>
      (await api.post(`/quotes/${id}/nova-versao`)).data,
    onSuccess: (data: Quote) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      window.location.href = `/orcamentos/${data.id}`;
    },
  });

  const generateContract = useMutation({
    mutationFn: async () =>
      (await api.post("/quotes/contratos/", {
        client_id: q!.client_id,
        quote_id: q!.id,
        procedure_id: q!.procedure_id,
        total_value: q!.total,
        payment_model: "a_definir",
      })).data,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      window.location.href = `/contratos/${data.id}`;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="text-red-400" size={32} />
        <p className="text-gray-500 text-sm">Orçamento não encontrado.</p>
        <Link to="/orcamentos" className="text-primary-600 text-sm hover:underline">← Voltar</Link>
      </div>
    );
  }

  const canAdvance =
    q.status !== "assinado" && q.status !== "cancelado" && q.status !== "expirado";

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(q.status as QuoteStatus) + 1] as QuoteStatus | undefined;

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/orcamentos"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5"
      >
        <ArrowLeft size={16} />
        Orçamentos
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 font-mono">{q.formatted_number}</h1>
              <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${statusCls[q.status]}`}>
                {statusLabel[q.status]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {q.client_name ?? "—"}
              {q.procedure_type_label && (
                <span className="ml-2 text-gray-400">· {q.procedure_type_label}</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Advance status */}
            {nextStatus && canAdvance && (
              <button
                onClick={() => updateStatus.mutate(nextStatus)}
                disabled={updateStatus.isPending}
                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-md disabled:opacity-50"
              >
                Avançar → {statusLabel[nextStatus]}
              </button>
            )}

            {/* Cancel */}
            {canAdvance && q.status !== "rascunho" && (
              <button
                onClick={() => updateStatus.mutate("cancelado")}
                disabled={updateStatus.isPending}
                className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-md hover:bg-red-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            )}

            {/* New version */}
            <button
              onClick={() => newVersion.mutate()}
              disabled={newVersion.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={12} />
              Nova versão
            </button>

            {/* Generate contract */}
            {q.status === "assinado" && (
              <button
                onClick={() => generateContract.mutate()}
                disabled={generateContract.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md disabled:opacity-50"
              >
                <FileText size={12} />
                Gerar contrato
              </button>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          {q.valid_until && (
            <div>
              <p className="text-xs font-medium text-gray-500">Válido até</p>
              <p className="text-gray-800 mt-0.5">{formatDate(q.valid_until)}</p>
            </div>
          )}
          {q.sent_at && (
            <div>
              <p className="text-xs font-medium text-gray-500">Enviado em</p>
              <p className="text-gray-800 mt-0.5">{new Date(q.sent_at).toLocaleDateString("pt-BR")}</p>
            </div>
          )}
          {q.signed_at && (
            <div>
              <p className="text-xs font-medium text-gray-500">Assinado em</p>
              <p className="text-gray-800 mt-0.5">{new Date(q.signed_at).toLocaleDateString("pt-BR")}</p>
            </div>
          )}
          {q.procedure_id && (
            <div>
              <p className="text-xs font-medium text-gray-500">Procedimento</p>
              <Link to={`/procedimentos/${q.procedure_id}`} className="text-primary-600 hover:underline text-sm mt-0.5 block">
                Ver procedimento →
              </Link>
            </div>
          )}
        </div>

        {q.notas && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1">Observações</p>
            <p className="text-sm text-gray-700">{q.notas}</p>
          </div>
        )}
      </div>

      {/* Value breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Composição do orçamento</h2>

        <div className="space-y-2 text-sm">
          <ValueRow
            label="Honorários do escritório"
            value={q.honorarios_escritorio}
            cls="text-gray-700"
          />
          <ValueRow
            label="Honorários do despachante"
            value={q.honorarios_despachante}
            cls="text-gray-700"
          />

          {q.custas_estimadas.length > 0 && (
            <>
              <div className="pt-2 pb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Custas estimadas</p>
              </div>
              {q.custas_estimadas.map((c, i) => (
                <ValueRow key={i} label={c.name} value={c.value} cls="text-gray-600 pl-4" />
              ))}
              <ValueRow label="Subtotal custas" value={q.custas_total} cls="text-gray-500 font-medium" />
            </>
          )}

          <div className="border-t border-gray-100 pt-2 mt-2">
            <ValueRow label="Subtotal" value={q.subtotal} cls="text-gray-600 font-medium" />
            {q.desconto > 0 && (
              <div className="flex justify-between text-red-500 py-1">
                <span>
                  Desconto
                  {q.desconto_motivo && (
                    <span className="text-red-400 text-xs ml-1">({q.desconto_motivo})</span>
                  )}
                </span>
                <span>- {fmt(q.desconto)}</span>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-lg text-gray-900">
            <span>Total</span>
            <span>{fmt(q.total)}</span>
          </div>
        </div>
      </div>

      {/* D4Sign */}
      <D4SignPanel
        entityType="quotes"
        entityId={q.id}
        entityStatus={q.status}
        onSigned={() => qc.invalidateQueries({ queryKey: ["quote", id] })}
      />
    </div>
  );
}

function ValueRow({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`flex justify-between py-1 ${cls}`}>
      <span>{label}</span>
      <span>{value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
    </div>
  );
}
