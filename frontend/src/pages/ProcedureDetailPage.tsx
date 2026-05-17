import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, Clock, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import type { Procedure, Stage, StageStatus, ProcedureStatus } from "@/types";
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
