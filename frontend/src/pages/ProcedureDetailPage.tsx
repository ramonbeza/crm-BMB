import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, Clock, AlertCircle, ChevronDown, ChevronUp, FileText, Plus, User, Briefcase, DollarSign, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Procedure, Stage, StageStatus, ProcedureStatus, ChecklistItem, ChecklistStatus, ProcedureFinancialSummary, FinancialEntryListItem, PaginatedFinancialEntries, EntryTipo, EntryCategory } from "@/types";
import { formatDate } from "@/lib/utils";

// ── label maps ───────────────────────────────────────────────────────────────

const statusLabel: Record<ProcedureStatus, string> = {
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
const statusCls: Record<ProcedureStatus, string> = {
  em_andamento: "bg-blue-50 text-blue-700 border-blue-200",
  concluido: "bg-green-50 text-green-700 border-green-200",
  cancelado: "bg-gray-100 text-gray-500 border-gray-200",
};

const stageLabel: Record<StageStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};
const stageIcon: Record<StageStatus, typeof Circle> = {
  pendente: Circle,
  em_andamento: Clock,
  concluida: CheckCircle2,
};
const stageCls: Record<StageStatus, string> = {
  pendente: "text-gray-400",
  em_andamento: "text-blue-500",
  concluida: "text-green-500",
};

// ── StageRow ─────────────────────────────────────────────────────────────────

interface StageRowProps {
  stage: Stage;
  procedureId: string;
  onUpdate: () => void;
}

function StageRow({ stage, procedureId, onUpdate }: StageRowProps) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(stage.notes ?? "");
  const [dueDate, setDueDate] = useState(stage.due_date ?? "");

  const update = useMutation({
    mutationFn: async (payload: Partial<{ status: StageStatus; due_date: string | null; notes: string | null }>) =>
      (await api.put(`/procedures/${procedureId}/stages/${stage.id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procedure", procedureId] });
      onUpdate();
    },
  });

  const Icon = stageIcon[stage.status];

  const cycleStatus = () => {
    const next: Record<StageStatus, StageStatus> = {
      pendente: "em_andamento",
      em_andamento: "concluida",
      concluida: "pendente",
    };
    update.mutate({ status: next[stage.status] });
  };

  const saveExtra = () => {
    update.mutate({
      due_date: dueDate || null,
      notes: notes || null,
    });
    setExpanded(false);
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${stage.status === "concluida" ? "border-green-200 bg-green-50/30" : "border-gray-200"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xs font-mono text-gray-400 w-5">{stage.order}</span>

        <button
          onClick={cycleStatus}
          disabled={update.isPending}
          className={`flex-shrink-0 transition-colors ${stageCls[stage.status]} hover:opacity-70`}
          title={`Status: ${stageLabel[stage.status]} — clique para avançar`}
        >
          <Icon size={20} />
        </button>

        <span className={`flex-1 text-sm font-medium ${stage.status === "concluida" ? "line-through text-gray-400" : "text-gray-800"}`}>
          {stage.name}
        </span>

        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
          stage.status === "pendente" ? "bg-gray-50 text-gray-500 border-gray-200" :
          stage.status === "em_andamento" ? "bg-blue-50 text-blue-600 border-blue-200" :
          "bg-green-50 text-green-600 border-green-200"
        }`}>
          {stageLabel[stage.status]}
        </span>

        {stage.due_date && (
          <span className="text-xs text-gray-400">{formatDate(stage.due_date)}</span>
        )}

        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-gray-400 hover:text-gray-600 ml-1"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-white space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prazo da etapa</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm"
              />
            </div>
            {stage.completed_at && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Concluída em</label>
                <p className="text-sm text-gray-500 pt-1.5">
                  {new Date(stage.completed_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre esta etapa..."
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveExtra}
              disabled={update.isPending}
              className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-md disabled:opacity-50"
            >
              Salvar
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="px-3 py-1.5 border border-gray-200 text-xs text-gray-600 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
          {stage.notes && !expanded && (
            <p className="text-xs text-gray-500 italic">{stage.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── ProcedureDetailPage ───────────────────────────────────────────────────────

export function ProcedureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: p, isLoading } = useQuery<Procedure>({
    queryKey: ["procedure", id],
    queryFn: async () => (await api.get<Procedure>(`/procedures/${id}`)).data,
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: async (newStatus: ProcedureStatus) =>
      (await api.put(`/procedures/${id}`, { status: newStatus })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procedure", id] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="text-red-400" size={32} />
        <p className="text-gray-500 text-sm">Procedimento não encontrado.</p>
        <Link to="/procedimentos" className="text-primary-600 text-sm hover:underline">
          ← Voltar
        </Link>
      </div>
    );
  }

  const protocolFormatted = `BMB-${new Date(p.opened_at).getFullYear()}-${String(p.protocol_number).padStart(4, "0")}`;
  const stagesDone = p.stages.filter((s) => s.status === "concluida").length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        to="/procedimentos"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5"
      >
        <ArrowLeft size={16} />
        Procedimentos
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">{protocolFormatted}</h1>
              <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${statusCls[p.status]}`}>
                {statusLabel[p.status]}
              </span>
              {p.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded bg-red-50 text-red-600 text-xs font-medium">
                  {t}
                </span>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-1">{p.procedure_type_label}</p>
          </div>

          {/* Status change */}
          <div className="flex gap-2">
            {(["em_andamento", "concluido", "cancelado"] as ProcedureStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => updateStatus.mutate(s)}
                disabled={p.status === s || updateStatus.isPending}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-40 disabled:cursor-default ${
                  p.status === s
                    ? statusCls[s]
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {statusLabel[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 mt-5 pt-5 border-t border-gray-100">
          <InfoField label="Cliente" value={p.client_name ?? "—"} />
          <InfoField label="Responsável" value={p.responsible_name ?? "—"} />
          <InfoField label="Data de abertura" value={formatDate(p.opened_at)} />
          {p.deadline && <InfoField label="Prazo" value={formatDate(p.deadline)} />}
          {p.requerente && <InfoField label="Requerente / Proprietário" value={p.requerente} />}
          {p.matricula && <InfoField label="Matrícula" value={p.matricula} />}
          {p.incra && <InfoField label="INCRA" value={p.incra} />}
          {p.inscricao_imobiliaria && (
            <InfoField label="Inscrição Imobiliária" value={p.inscricao_imobiliaria} />
          )}
        </div>

        {p.property_description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1">Descrição do imóvel</p>
            <p className="text-sm text-gray-700">{p.property_description}</p>
          </div>
        )}
      </div>

      {/* Stages */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Etapas do procedimento</h2>
          <div className="flex items-center gap-2">
            <div className="h-2 w-32 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${p.stages.length ? (stagesDone / p.stages.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">
              {stagesDone}/{p.stages.length} concluída{stagesDone !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {[...p.stages]
            .sort((a, b) => a.order - b.order)
            .map((stage) => (
              <StageRow
                key={stage.id}
                stage={stage}
                procedureId={p.id}
                onUpdate={() => qc.invalidateQueries({ queryKey: ["procedure", id] })}
              />
            ))}
        </div>
      </div>

      {/* Checklist */}
      <ChecklistPanel procedureId={p.id} items={p.checklist_items} />

      {/* Financeiro */}
      <FinancialPanel procedureId={p.id} />
    </div>
  );
}

// ── ChecklistPanel ────────────────────────────────────────────────────────────

const checklistStatusLabel: Record<ChecklistStatus, string> = {
  pendente: "Pendente",
  recebido: "Recebido",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

const checklistStatusCls: Record<ChecklistStatus, string> = {
  pendente: "bg-gray-100 text-gray-500",
  recebido: "bg-blue-50 text-blue-600",
  em_analise: "bg-amber-50 text-amber-600",
  aprovado: "bg-green-50 text-green-600",
  rejeitado: "bg-red-50 text-red-600",
};

function ChecklistPanel({ procedureId, items }: { procedureId: string; items: ChecklistItem[] }) {
  const qc = useQueryClient();
  const [newItem, setNewItem] = useState("");
  const [newResp, setNewResp] = useState<"cliente" | "escritorio">("cliente");
  const [addingItem, setAddingItem] = useState(false);

  const updateItem = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) =>
      (await api.put(`/properties/checklist/item/${itemId}`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procedure", procedureId] }),
  });

  const addItem = useMutation({
    mutationFn: async () =>
      (await api.post(`/properties/checklist/${procedureId}`, { name: newItem, responsavel: newResp })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procedure", procedureId] });
      setNewItem("");
      setAddingItem(false);
    },
  });

  const nextStatus: Record<string, ChecklistStatus> = {
    pendente: "recebido",
    recebido: "em_analise",
    em_analise: "aprovado",
    aprovado: "pendente",
    rejeitado: "pendente",
  };

  const done = items.filter((i) => i.status === "aprovado").length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mt-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-gray-400" />
          <h2 className="text-base font-bold text-gray-900">Checklist de documentos</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{done}/{items.length} aprovado{done !== 1 ? "s" : ""}</span>
          <button
            onClick={() => setAddingItem((v) => !v)}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
          >
            <Plus size={14} />
            Adicionar
          </button>
        </div>
      </div>

      {items.length === 0 && !addingItem && (
        <p className="text-sm text-gray-400 text-center py-6">
          Nenhum item de checklist. Este tipo de procedimento não possui template pré-definido ou nenhum item foi adicionado.
        </p>
      )}

      <div className="space-y-1.5">
        {[...items].sort((a, b) => a.order - b.order).map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
              item.status === "aprovado"
                ? "border-green-200 bg-green-50/30"
                : item.status === "rejeitado"
                ? "border-red-200 bg-red-50/30"
                : "border-gray-100 hover:bg-gray-50"
            }`}
          >
            <span className="text-xs text-gray-400 w-5 flex-shrink-0">{item.order}</span>

            <span className={`flex-1 text-sm ${item.status === "aprovado" ? "line-through text-gray-400" : "text-gray-800"}`}>
              {item.name}
            </span>

            <span
              className={`flex items-center gap-1 text-xs flex-shrink-0 ${
                item.responsavel === "cliente" ? "text-blue-500" : "text-purple-500"
              }`}
              title={item.responsavel === "cliente" ? "Responsável: Cliente" : "Responsável: Escritório"}
            >
              {item.responsavel === "cliente" ? <User size={12} /> : <Briefcase size={12} />}
              {item.responsavel === "cliente" ? "Cliente" : "Escritório"}
            </span>

            <button
              onClick={() => updateItem.mutate({ itemId: item.id, status: nextStatus[item.status] })}
              disabled={updateItem.isPending}
              className={`text-xs px-2 py-0.5 rounded-full font-medium border cursor-pointer transition-colors hover:opacity-80 ${checklistStatusCls[item.status as ChecklistStatus]} border-current/20`}
              title="Clique para avançar o status"
            >
              {checklistStatusLabel[item.status as ChecklistStatus]}
            </button>
          </div>
        ))}
      </div>

      {addingItem && (
        <div className="mt-3 p-3 border border-dashed border-gray-300 rounded-lg bg-gray-50 space-y-2">
          <input
            autoFocus
            placeholder="Nome do documento..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newItem.trim() && addItem.mutate()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <div className="flex items-center gap-2">
            <select
              value={newResp}
              onChange={(e) => setNewResp(e.target.value as "cliente" | "escritorio")}
              className="px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white"
            >
              <option value="cliente">Responsável: Cliente</option>
              <option value="escritorio">Responsável: Escritório</option>
            </select>
            <button
              onClick={() => addItem.mutate()}
              disabled={!newItem.trim() || addItem.isPending}
              className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-medium rounded-md"
            >
              Adicionar
            </button>
            <button
              onClick={() => { setAddingItem(false); setNewItem(""); }}
              className="px-3 py-1.5 border border-gray-200 text-xs text-gray-600 rounded-md hover:bg-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FinancialPanel ────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

const entryStatusCls: Record<string, string> = {
  pendente: "bg-amber-50 text-amber-700",
  pago: "bg-green-50 text-green-700",
  cancelado: "bg-gray-100 text-gray-400",
};
const tipoBadge: Record<string, string> = {
  custa_real: "bg-red-50 text-red-600",
  repasse_despachante: "bg-purple-50 text-purple-600",
  honorario_recebido: "bg-blue-50 text-blue-600",
};

function FinancialPanel({ procedureId }: { procedureId: string }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    tipo: "custa_real" as EntryTipo,
    category: "cartorio" as EntryCategory,
    description: "",
    value: "",
    status: "pendente",
    due_date: "",
    notas: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const { data: summary } = useQuery<ProcedureFinancialSummary>({
    queryKey: ["financial-summary", procedureId],
    queryFn: async () =>
      (await api.get<ProcedureFinancialSummary>(`/financial/procedure/${procedureId}`)).data,
  });

  const { data: entries } = useQuery<PaginatedFinancialEntries>({
    queryKey: ["financial-entries-proc", procedureId],
    queryFn: async () =>
      (await api.get<PaginatedFinancialEntries>("/financial/", {
        params: { procedure_id: procedureId, page_size: 50 },
      })).data,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post("/financial/", {
        procedure_id: procedureId,
        tipo: form.tipo,
        category: form.category,
        description: form.description,
        value: parseFloat(form.value.replace(",", ".")) || 0,
        status: form.status,
        due_date: form.due_date || null,
        notas: form.notas || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-entries-proc", procedureId] });
      qc.invalidateQueries({ queryKey: ["financial-summary", procedureId] });
      qc.invalidateQueries({ queryKey: ["financial-dashboard"] });
      setShowCreate(false);
      setForm({ tipo: "custa_real", category: "cartorio", description: "", value: "", status: "pendente", due_date: "", notas: "" });
    },
  });

  const payMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/financial/${id}/pagar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-entries-proc", procedureId] });
      qc.invalidateQueries({ queryKey: ["financial-summary", procedureId] });
    },
  });

  const items = entries?.items ?? [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mt-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-gray-400" />
          <h2 className="text-base font-bold text-gray-900">Financeiro do procedimento</h2>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
        >
          <Plus size={14} />
          Lançamento
        </button>
      </div>

      {/* Summary grid */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-0.5">Orçado total</p>
            <p className="text-sm font-bold text-gray-900">{fmt(summary.total_orcado)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-0.5">Custas estimadas</p>
            <p className="text-sm font-bold text-gray-900">{fmt(summary.custas_estimadas_total)}</p>
          </div>
          <div className={`rounded-lg p-3 ${summary.variacao_custas > 0 ? "bg-red-50" : "bg-green-50"}`}>
            <p className="text-xs text-gray-500 mb-0.5">Variação custas</p>
            <p className={`text-sm font-bold ${summary.variacao_custas > 0 ? "text-red-600" : "text-green-600"}`}>
              {summary.variacao_custas >= 0 ? "+" : ""}{fmt(summary.variacao_custas)}
            </p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-0.5">Custas reais pendentes</p>
            <p className="text-sm font-bold text-amber-700">{fmt(summary.custas_reais_pendentes)}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-0.5">Repasses pendentes</p>
            <p className="text-sm font-bold text-purple-700">{fmt(summary.repasses_pendentes)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-0.5">Parcelas a receber</p>
            <p className="text-sm font-bold text-blue-700">{fmt(summary.parcelas_pendentes)}</p>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 p-4 border border-dashed border-primary-300 rounded-lg bg-primary-50/30 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">Novo lançamento</p>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => set("tipo", e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white"
              >
                {TIPO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white"
              >
                {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <input
            type="text"
            placeholder="Descrição *"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          />

          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Valor R$"
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1.5"
            />
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white"
            >
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
            </select>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => set("due_date", e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1.5"
              placeholder="Vencimento"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.description || !form.value}
              className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded disabled:opacity-50"
            >
              {createMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 border border-gray-200 text-xs text-gray-600 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Entries list */}
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          Nenhum lançamento financeiro registrado para este procedimento.
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((entry: FinancialEntryListItem) => (
            <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 hover:bg-gray-50">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${tipoBadge[entry.tipo] ?? ""}`}>
                {entry.tipo_label}
              </span>
              <span className="flex-1 text-sm text-gray-800 truncate">{entry.description}</span>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmt(entry.value)}</span>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${entryStatusCls[entry.status] ?? ""}`}>
                {entry.status_label}
              </span>
              {entry.due_date && (
                <span className="text-xs text-gray-400">
                  {new Date(entry.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                </span>
              )}
              {entry.status === "pendente" && (
                <button
                  onClick={() => payMutation.mutate(entry.id)}
                  disabled={payMutation.isPending}
                  className="text-xs text-green-600 hover:text-green-800 disabled:opacity-40"
                  title="Marcar como pago"
                >
                  <CheckCircle2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}
