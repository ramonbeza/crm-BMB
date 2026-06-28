/**
 * Painel de geração de documentos com IA — agrupado por tipo de procedimento.
 */
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, CheckCheck, Copy, FileText, Loader2,
  RefreshCw, Sparkles, Trash2,
} from "lucide-react";
import { api } from "@/lib/api";

interface DocType {
  value: string;
  label: string;
  suggested?: boolean;
}

interface AIDoc {
  id: string;
  procedure_id: string;
  doc_type: string;
  doc_type_label: string;
  status: "pendente" | "gerando" | "concluido" | "falhou";
  content: string | null;
  error_message: string | null;
  model_used: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  created_at: string;
  updated_at: string;
}

const statusConfig = {
  pendente:  { label: "Na fila",   cls: "bg-gray-100 text-gray-600",   icon: null   },
  gerando:   { label: "Gerando...", cls: "bg-blue-50 text-blue-700",   icon: "spin" },
  concluido: { label: "Pronto",    cls: "bg-green-50 text-green-700",  icon: null   },
  falhou:    { label: "Falhou",    cls: "bg-red-50 text-red-700",      icon: null   },
};

// Campos extras por tipo de documento
const ADVANCED_FIELDS: Record<string, { key: string; label: string; placeholder?: string }[]> = {
  notificacao_extrajudicial: [
    { key: "notified_name",         label: "Nome do Notificado",     placeholder: "João da Silva" },
    { key: "notified_address",      label: "Endereço do Notificado", placeholder: "Rua X, 123, Cidade - UF" },
    { key: "notification_subject",  label: "Assunto",                placeholder: "Irregularidade na posse..." },
  ],
  declaracao: [
    { key: "declaration_subject", label: "Objeto da Declaração", placeholder: "Declaro para fins de..." },
  ],
  procuracao: [
    { key: "powers", label: "Poderes Específicos", placeholder: "Representar perante o INCRA, prefeitura..." },
  ],
  minuta_contrato: [
    { key: "other_parties",    label: "Outras Partes",        placeholder: "Maria Santos, CPF 000.000.000-00" },
    { key: "contract_object",  label: "Objeto do Contrato",   placeholder: "Compra e venda do imóvel..." },
  ],
  contrato_cessao: [
    { key: "other_parties",  label: "Cessionário",    placeholder: "Nome e qualificação do cessionário" },
    { key: "fee_total",      label: "Valor da Cessão", placeholder: "R$ 250.000,00" },
  ],
  parecer: [
    { key: "legal_question", label: "Questão Jurídica", placeholder: "Qual a viabilidade de usucapião..." },
  ],
  contrato_honorarios: [
    { key: "fee_total",       label: "Valor dos Honorários",  placeholder: "R$ 10.000,00" },
    { key: "payment_model",   label: "Modalidade",            placeholder: "fixo / parcelado / êxito" },
  ],
  recibo_pagamento: [
    { key: "fee_total",     label: "Valor",              placeholder: "R$ 5.000,00" },
    { key: "payment_model", label: "Forma de Pagamento", placeholder: "transferência bancária / PIX" },
  ],
  ata_notarial: [
    { key: "extra_instructions", label: "Detalhes da Posse", placeholder: "Tempo de posse, benfeitorias realizadas, uso do imóvel..." },
  ],
  anuencia_confrontantes: [
    { key: "extra_instructions", label: "Confrontantes", placeholder: "Norte: [nome]; Sul: [nome]; Leste: [nome]; Oeste: [nome]" },
  ],
  formal_partilha: [
    { key: "extra_instructions", label: "Herdeiros e Bens", placeholder: "Liste herdeiros com CPF e bens a partilhar..." },
  ],
  minuta_escritura: [
    { key: "contract_object", label: "Tipo de Escritura",    placeholder: "Compra e Venda / Inventário e Partilha / Doação" },
    { key: "fee_total",       label: "Valor da Escritura",   placeholder: "R$ 500.000,00" },
  ],
  oficio_cartorio: [
    { key: "extra_instructions", label: "Objeto do Ofício", placeholder: "Solicitar certidão de ônus reais atualizada..." },
  ],
  oficio_prefeitura: [
    { key: "extra_instructions", label: "Objeto do Ofício", placeholder: "Solicitar aprovação do projeto de loteamento..." },
  ],
};

interface Props {
  procedureId: string;
  procedureType?: string;
}

export function AIDocumentPanel({ procedureId, procedureType }: Props) {
  const qc = useQueryClient();
  const [selectedDocType, setSelectedDocType] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedFields, setAdvancedFields] = useState<Record<string, string>>({});
  const [selectedDoc, setSelectedDoc] = useState<AIDoc | null>(null);
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tipos por procedimento (sugeridos primeiro) ou todos
  const typesUrl = procedureType
    ? `/ai/types/procedure/${procedureType}`
    : "/ai/types";

  const { data: docTypes } = useQuery<DocType[]>({
    queryKey: ["ai-doc-types", procedureType],
    queryFn: async () => (await api.get(typesUrl)).data,
  });

  const { data: docs, refetch } = useQuery<AIDoc[]>({
    queryKey: ["ai-docs", procedureId],
    queryFn: async () => (await api.get(`/ai/procedures/${procedureId}/documents`)).data,
  });

  useEffect(() => {
    const hasPending = docs?.some((d) => d.status === "pendente" || d.status === "gerando");
    if (hasPending) {
      pollingRef.current = setTimeout(() => refetch(), 3000);
    }
    return () => { if (pollingRef.current) clearTimeout(pollingRef.current); };
  }, [docs]);

  useEffect(() => {
    if (selectedDoc) {
      const updated = docs?.find((d) => d.id === selectedDoc.id);
      if (updated) setSelectedDoc(updated);
    }
  }, [docs]);

  const generate = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {
        doc_type: selectedDocType,
        extra_instructions: extraInstructions,
        ...advancedFields,
      };
      return (await api.post(`/ai/procedures/${procedureId}/generate`, payload)).data;
    },
    onSuccess: (doc: AIDoc) => {
      qc.invalidateQueries({ queryKey: ["ai-docs", procedureId] });
      setSelectedDoc(doc);
      setExtraInstructions("");
      setAdvancedFields({});
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/ai/documents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-docs", procedureId] });
      setSelectedDoc(null);
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentAdvancedFields = ADVANCED_FIELDS[selectedDocType] || [];
  const suggestedTypes = docTypes?.filter((t) => t.suggested) ?? [];
  const otherTypes = docTypes?.filter((t) => !t.suggested) ?? [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Gerador */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-xs text-gray-500">
            Selecione o tipo de documento. A IA usará os dados do procedimento, documentos extraídos e qualificações para gerar um rascunho.
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de documento *</label>
            <select
              value={selectedDocType}
              onChange={(e) => { setSelectedDocType(e.target.value); setShowAdvanced(false); setAdvancedFields({}); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
            >
              <option value="">— selecione —</option>
              {suggestedTypes.length > 0 && (
                <optgroup label="✦ Sugeridos para este procedimento">
                  {suggestedTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
              )}
              {otherTypes.length > 0 && (
                <optgroup label="Outros documentos">
                  {otherTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Instruções adicionais (opcional)</label>
            <textarea
              rows={2}
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              placeholder="Ex: incluir cláusula de rescisão com 30 dias de aviso prévio..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          {currentAdvancedFields.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-violet-600 hover:text-violet-800 font-medium"
              >
                {showAdvanced ? "▲ Ocultar campos" : "▼ Preencher campos específicos"}
              </button>
              {showAdvanced && (
                <div className="mt-2 space-y-2">
                  {currentAdvancedFields.map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">{f.label}</label>
                      <input
                        value={advancedFields[f.key] ?? ""}
                        onChange={(e) => setAdvancedFields((p) => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-300"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {generate.isError && (
            <p className="text-xs text-red-600">Erro ao solicitar geração. Tente novamente.</p>
          )}

          <button
            onClick={() => generate.mutate()}
            disabled={!selectedDocType || generate.isPending}
            className="w-full flex items-center justify-center gap-2 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {generate.isPending ? (
              <><Loader2 size={15} className="animate-spin" /> Gerando...</>
            ) : (
              <><Sparkles size={15} /> Gerar Documento</>
            )}
          </button>
        </div>

        {/* Lista de documentos gerados */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Documentos gerados ({docs?.length ?? 0})
            </span>
            <button onClick={() => refetch()} className="text-gray-400 hover:text-gray-600">
              <RefreshCw size={13} />
            </button>
          </div>

          {!docs?.length ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <FileText size={32} className="mb-2 opacity-30" />
              <p className="text-xs">Nenhum documento gerado ainda.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {docs.map((doc) => {
                const cfg = statusConfig[doc.status];
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedDoc?.id === doc.id ? "bg-violet-50" : ""}`}
                  >
                    <FileText size={14} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{doc.doc_type_label}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(doc.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        {doc.tokens_output ? ` · ${doc.tokens_output} tokens` : ""}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 flex-shrink-0 ${cfg.cls}`}>
                      {cfg.icon === "spin" && <Loader2 size={11} className="animate-spin" />}
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Visualizador */}
      {selectedDoc && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-violet-500" />
              <span className="text-sm font-semibold text-gray-800">{selectedDoc.doc_type_label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig[selectedDoc.status].cls}`}>
                {statusConfig[selectedDoc.status].label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedDoc.status === "concluido" && selectedDoc.content && (
                <button
                  onClick={() => copyToClipboard(selectedDoc.content!)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2.5 py-1.5 border border-gray-200 rounded-lg transition-colors"
                >
                  {copied ? <CheckCheck size={13} className="text-green-500" /> : <Copy size={13} />}
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              )}
              <button
                onClick={() => del.mutate(selectedDoc.id)}
                disabled={del.isPending}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2.5 py-1.5 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {(selectedDoc.status === "gerando" || selectedDoc.status === "pendente") ? (
            <div className="flex items-center justify-center py-12 gap-3 text-violet-600">
              <Loader2 size={20} className="animate-spin" />
              <p className="text-sm">A IA está redigindo o documento...</p>
            </div>
          ) : selectedDoc.status === "falhou" ? (
            <div className="flex items-center gap-3 px-4 py-6 text-red-700">
              <AlertCircle size={20} className="flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Falha na geração</p>
                <p className="text-xs text-red-500 mt-0.5">{selectedDoc.error_message}</p>
              </div>
            </div>
          ) : (
            <div className="p-4">
              {selectedDoc.model_used && (
                <p className="text-xs text-gray-400 mb-3">
                  Modelo: {selectedDoc.model_used} · {selectedDoc.tokens_input} tokens entrada · {selectedDoc.tokens_output} tokens saída
                </p>
              )}
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed bg-gray-50 rounded-lg p-4 max-h-[32rem] overflow-y-auto">
                {selectedDoc.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
