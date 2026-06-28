/**
 * Assistente de fluxo — analisa o estado do procedimento e sugere ações.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, AlertTriangle, ArrowRight, CheckCircle2,
  ChevronDown, ChevronUp, CircleDot, FileText, Loader2,
  Sparkles, TrendingUp, XCircle,
} from "lucide-react";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChecklistSugestao {
  item_id: string;
  item_nome: string;
  novo_status: string;
  justificativa: string;
}

interface DocumentoFaltante {
  nome: string;
  urgencia: "alta" | "media" | "baixa";
  responsavel: "cliente" | "escritorio";
  observacao: string | null;
}

interface DocumentoGerar {
  doc_type: string;
  label: string;
  justificativa: string;
}

interface WorkflowSuggestion {
  resumo: string;
  progresso_estimado: number;
  checklist_sugeridos: ChecklistSugestao[];
  pode_avancar_etapa: boolean;
  avaliacao_etapa_atual: string;
  documentos_faltantes: DocumentoFaltante[];
  documentos_gerar: DocumentoGerar[];
  proximas_acoes: string[];
}

const urgenciaCls = {
  alta:  "bg-red-50 text-red-700 border border-red-200",
  media: "bg-amber-50 text-amber-700 border border-amber-200",
  baixa: "bg-gray-50 text-gray-600 border border-gray-200",
};

const urgenciaLabel = { alta: "Urgente", media: "Médio prazo", baixa: "Quando possível" };

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  procedureId: string;
  onGenerateDoc?: (docType: string) => void;
}

export function WorkflowAssistantPanel({ procedureId, onGenerateDoc }: Props) {
  const qc = useQueryClient();
  const [result, setResult] = useState<WorkflowSuggestion | null>(null);
  const [showFaltantes, setShowFaltantes] = useState(true);
  const [showGerar, setShowGerar] = useState(true);
  const [appliedItems, setAppliedItems] = useState<Set<string>>(new Set());
  const [applyingItems, setApplyingItems] = useState<Set<string>>(new Set());

  const analyze = useMutation({
    mutationFn: async () =>
      (await api.post<WorkflowSuggestion>(`/ai/procedures/${procedureId}/suggest-workflow`)).data,
    onSuccess: (data) => {
      setResult(data);
      setAppliedItems(new Set());
    },
  });

  const applyChecklistItem = async (item: ChecklistSugestao) => {
    setApplyingItems((p) => new Set(p).add(item.item_id));
    try {
      await api.put(`/properties/checklist/item/${item.item_id}`, {
        status: item.novo_status,
        notas: `Atualizado automaticamente pela IA: ${item.justificativa}`,
      });
      setAppliedItems((p) => new Set(p).add(item.item_id));
      qc.invalidateQueries({ queryKey: ["procedure", procedureId] });
    } catch {
      // silently fail — user can retry
    } finally {
      setApplyingItems((p) => { const s = new Set(p); s.delete(item.item_id); return s; });
    }
  };

  const applyAll = async (items: ChecklistSugestao[]) => {
    for (const item of items) {
      if (!appliedItems.has(item.item_id)) {
        await applyChecklistItem(item);
      }
    }
  };

  if (!result && !analyze.isPending && !analyze.isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="p-3 bg-violet-50 rounded-xl">
          <Sparkles size={24} className="text-violet-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">Assistente de Fluxo</p>
          <p className="text-xs text-gray-500 mt-1 max-w-xs">
            A IA analisa o estado atual — etapas, checklist e documentos extraídos — e sugere as próximas ações.
          </p>
        </div>
        <button
          onClick={() => analyze.mutate()}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg"
        >
          <Sparkles size={15} />
          Analisar procedimento
        </button>
      </div>
    );
  }

  if (analyze.isPending) {
    return (
      <div className="py-12 flex flex-col items-center gap-3 text-violet-600">
        <Loader2 size={28} className="animate-spin" />
        <p className="text-sm">Analisando etapas, checklist e documentos...</p>
      </div>
    );
  }

  if (analyze.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertCircle size={24} className="text-red-400" />
        <p className="text-sm text-red-600">Não foi possível gerar a análise. Tente novamente.</p>
        <button
          onClick={() => analyze.mutate()}
          className="text-xs text-violet-600 hover:underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!result) return null;

  const pendingChecklist = result.checklist_sugeridos.filter(
    (i) => !appliedItems.has(i.item_id)
  );

  return (
    <div className="space-y-5">
      {/* Resumo + progresso */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Sparkles size={18} className="text-violet-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-sm font-semibold text-violet-900">Análise do procedimento</span>
              <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                {result.progresso_estimado}% concluído
              </span>
              {result.pode_avancar_etapa ? (
                <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200 font-medium">
                  <CheckCircle2 size={11} />
                  Pronto para avançar etapa
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 font-medium">
                  <CircleDot size={11} />
                  Etapa em andamento
                </span>
              )}
            </div>

            {/* Barra de progresso */}
            <div className="h-1.5 bg-violet-100 rounded-full mb-2 overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${result.progresso_estimado}%` }}
              />
            </div>

            <p className="text-sm text-violet-800">{result.resumo}</p>
            {result.avaliacao_etapa_atual && (
              <p className="text-xs text-violet-600 mt-1.5 italic">{result.avaliacao_etapa_atual}</p>
            )}
          </div>
        </div>
      </div>

      {/* Checklist sugerido */}
      {result.checklist_sugeridos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-green-500" />
              Checklist — atualizar automaticamente ({result.checklist_sugeridos.length})
            </h4>
            {pendingChecklist.length > 1 && (
              <button
                onClick={() => applyAll(result.checklist_sugeridos)}
                className="text-xs text-violet-600 hover:text-violet-800 font-medium"
              >
                Aplicar todos →
              </button>
            )}
          </div>
          <div className="space-y-2">
            {result.checklist_sugeridos.map((item) => {
              const applied = appliedItems.has(item.item_id);
              const applying = applyingItems.has(item.item_id);
              return (
                <div
                  key={item.item_id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${applied ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{item.item_nome}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.justificativa}</p>
                  </div>
                  {applied ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 flex-shrink-0">
                      <CheckCircle2 size={14} />
                      Aplicado
                    </span>
                  ) : (
                    <button
                      onClick={() => applyChecklistItem(item)}
                      disabled={applying}
                      className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg flex-shrink-0 font-medium"
                    >
                      {applying ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                      Aplicar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Documentos faltantes */}
      {result.documentos_faltantes.length > 0 && (
        <div>
          <button
            onClick={() => setShowFaltantes((p) => !p)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 hover:text-gray-700 w-full text-left"
          >
            <AlertTriangle size={13} className="text-amber-500" />
            Documentos faltantes ({result.documentos_faltantes.length})
            {showFaltantes ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
          </button>
          {showFaltantes && (
            <div className="space-y-2">
              {result.documentos_faltantes.map((doc, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white">
                  <XCircle size={15} className="text-gray-300 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-800">{doc.nome}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${urgenciaCls[doc.urgencia]}`}>
                        {urgenciaLabel[doc.urgencia]}
                      </span>
                      <span className="text-[10px] text-gray-400 capitalize">({doc.responsavel})</span>
                    </div>
                    {doc.observacao && (
                      <p className="text-xs text-gray-500 mt-0.5">{doc.observacao}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Documentos a gerar */}
      {result.documentos_gerar.length > 0 && (
        <div>
          <button
            onClick={() => setShowGerar((p) => !p)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 hover:text-gray-700 w-full text-left"
          >
            <FileText size={13} className="text-violet-500" />
            Documentos sugeridos para gerar ({result.documentos_gerar.length})
            {showGerar ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
          </button>
          {showGerar && (
            <div className="space-y-2">
              {result.documentos_gerar.map((doc, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white">
                  <Sparkles size={14} className="text-violet-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{doc.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{doc.justificativa}</p>
                  </div>
                  {onGenerateDoc && (
                    <button
                      onClick={() => onGenerateDoc(doc.doc_type)}
                      className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 px-2.5 py-1.5 border border-violet-200 rounded-lg flex-shrink-0 font-medium hover:bg-violet-50"
                    >
                      Gerar <ArrowRight size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Próximas ações */}
      {result.proximas_acoes.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <TrendingUp size={13} className="text-blue-500" />
            Próximas ações recomendadas
          </h4>
          <ol className="space-y-1.5">
            {result.proximas_acoes.map((acao, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {acao}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Nova análise */}
      <button
        onClick={() => analyze.mutate()}
        disabled={analyze.isPending}
        className="text-xs text-gray-400 hover:text-violet-600 flex items-center gap-1.5"
      >
        <Sparkles size={12} />
        Refazer análise
      </button>
    </div>
  );
}
