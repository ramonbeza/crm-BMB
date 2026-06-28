import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, BookOpen, Check, ChevronDown, ChevronUp,
  FileText, Loader2, Plus, Scale, Trash2, Upload, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LegalDoc {
  id: string;
  name: string;
  doc_type: string;
  doc_type_label: string;
  scope: string;
  scope_label: string;
  municipio: string | null;
  estado: string | null;
  numero: string | null;
  ano: string | null;
  descricao: string | null;
  summary: string | null;
  content_type: string | null;
  file_size: number | null;
  has_file: boolean;
}

interface ProcedureTypeOption {
  value: string;
  label: string;
}

interface ConsultResult {
  procedimento: string;
  resumo: string;
  documentos_necessarios: Array<{
    documento: string;
    descricao: string;
    embasamento: string;
    obrigatorio: boolean;
    prazo?: string | null;
  }>;
  taxas_e_custas: Array<{
    descricao: string;
    base_legal: string;
    observacao: string;
  }>;
  observacoes: string[];
  legislacao_aplicavel: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DOC_TYPES = [
  { value: "plano_diretor", label: "Plano Diretor" },
  { value: "lei_complementar", label: "Lei Complementar" },
  { value: "lei_ordinaria", label: "Lei Ordinária" },
  { value: "decreto", label: "Decreto" },
  { value: "resolucao_cnj", label: "Resolução CNJ" },
  { value: "instrucao_normativa", label: "Instrução Normativa" },
  { value: "provimento_cnj", label: "Provimento CNJ" },
  { value: "norma_abnt", label: "Norma ABNT" },
  { value: "outro", label: "Outro" },
];

const SCOPE_OPTIONS = [
  { value: "federal", label: "Federal" },
  { value: "estadual", label: "Estadual" },
  { value: "municipal", label: "Municipal" },
];

const scopeCls: Record<string, string> = {
  federal: "bg-purple-50 text-purple-700",
  estadual: "bg-blue-50 text-blue-700",
  municipal: "bg-green-50 text-green-700",
};

// ── ConsultPanel ──────────────────────────────────────────────────────────────

function ConsultPanel({ docs }: { docs: LegalDoc[] }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [procedureType, setProcedureType] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [result, setResult] = useState<ConsultResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(true);

  const { data: procTypes } = useQuery<ProcedureTypeOption[]>({
    queryKey: ["procedure-types"],
    queryFn: async () => (await api.get<ProcedureTypeOption[]>("/legal-docs/procedure-types")).data,
  });

  const toggleDoc = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConsult = async () => {
    if (!procedureType || selectedIds.size === 0) return;
    setStreaming(true);
    setStreamText("");
    setResult(null);
    setError(null);

    const apiUrl = import.meta.env.VITE_API_URL as string;
    let fullText = "";

    try {
      const res = await fetch(`${apiUrl}/legal-docs/consult-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          procedure_type: procedureType,
          doc_ids: [...selectedIds],
          municipio: municipio || null,
        }),
      });

      if (!res.ok) throw new Error("Erro na consulta");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              fullText += parsed.text;
              setStreamText(fullText);
            }
          } catch { /* skip malformed */ }
        }
      }

      const clean = fullText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
      setResult(JSON.parse(clean) as ConsultResult);
      setStreamText("");
    } catch (e: any) {
      setError(e.message ?? "Erro desconhecido");
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Scale size={18} className="text-primary-500" />
        <h2 className="text-base font-bold text-gray-900">Consulta com IA</h2>
        <span className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded font-medium">Claude</span>
      </div>

      <p className="text-sm text-gray-500">
        Selecione o tipo de procedimento e os documentos legislativos que devem ser consultados.
        A IA analisará a legislação e retornará a lista de documentos necessários e taxas.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de procedimento *</label>
          <select
            value={procedureType}
            onChange={(e) => setProcedureType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
          >
            <option value="">— selecione —</option>
            {procTypes?.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Município (opcional)</label>
          <input
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            placeholder="Ex: São Paulo"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
          />
        </div>
      </div>

      {/* Seleção de documentos */}
      <div>
        <button
          onClick={() => setShowDocs((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"
        >
          {showDocs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Legislação disponível ({selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""})
        </button>
        {showDocs && (
          <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-2">
            {docs.length === 0 ? (
              <p className="text-xs text-gray-400 py-2 text-center">Nenhum documento cadastrado ainda.</p>
            ) : (
              docs.map((d) => (
                <label key={d.id} className="flex items-start gap-2.5 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(d.id)}
                    onChange={() => toggleDoc(d.id)}
                    className="mt-0.5 accent-primary-600"
                  />
                  <span className="text-sm text-gray-800 flex-1">
                    {d.name}
                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${scopeCls[d.scope] ?? "bg-gray-100 text-gray-500"}`}>
                      {d.scope_label}
                    </span>
                    {d.has_file && (
                      <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">PDF</span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleConsult}
        disabled={streaming || !procedureType || selectedIds.size === 0}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
      >
        {streaming ? <Loader2 size={15} className="animate-spin" /> : <Scale size={15} />}
        {streaming ? "Analisando legislação..." : "Consultar legislação"}
      </button>

      {/* Streaming text */}
      {streaming && streamText && (
        <pre className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap font-mono leading-relaxed">
          {streamText}
          <span className="inline-block w-1.5 h-3.5 bg-primary-400 ml-0.5 animate-pulse align-middle" />
        </pre>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Result */}
      {result && <ConsultResult result={result} />}
    </div>
  );
}

function ConsultResult({ result }: { result: ConsultResult }) {
  return (
    <div className="space-y-5 pt-2">
      <div className="bg-primary-50 border border-primary-100 rounded-lg px-4 py-3">
        <p className="text-xs font-semibold text-primary-700 mb-1">{result.procedimento}</p>
        <p className="text-sm text-gray-700">{result.resumo}</p>
      </div>

      {result.documentos_necessarios?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-3">
            Documentos Necessários ({result.documentos_necessarios.length})
          </h3>
          <div className="space-y-2">
            {result.documentos_necessarios.map((doc, i) => (
              <div key={i} className={`border rounded-lg px-4 py-3 ${doc.obrigatorio ? "border-gray-200" : "border-dashed border-gray-200 bg-gray-50"}`}>
                <div className="flex items-start gap-2 mb-1">
                  <Check size={14} className={`mt-0.5 flex-shrink-0 ${doc.obrigatorio ? "text-green-600" : "text-gray-400"}`} />
                  <span className="text-sm font-medium text-gray-900">{doc.documento}</span>
                  {!doc.obrigatorio && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded ml-auto flex-shrink-0">Opcional</span>
                  )}
                </div>
                {doc.descricao && <p className="text-xs text-gray-500 ml-5">{doc.descricao}</p>}
                {doc.embasamento && (
                  <p className="text-xs text-primary-600 ml-5 mt-1 font-medium">{doc.embasamento}</p>
                )}
                {doc.prazo && <p className="text-xs text-amber-600 ml-5 mt-0.5">Prazo: {doc.prazo}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.taxas_e_custas?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-3">Taxas e Custas</h3>
          <div className="space-y-2">
            {result.taxas_e_custas.map((t, i) => (
              <div key={i} className="border border-amber-100 bg-amber-50 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{t.descricao}</p>
                {t.base_legal && <p className="text-xs text-primary-600 mt-0.5">{t.base_legal}</p>}
                {t.observacao && <p className="text-xs text-gray-500 mt-0.5">{t.observacao}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.observacoes?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-2">Observações</h3>
          <ul className="space-y-1">
            {result.observacoes.map((obs, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-primary-400 mt-1 flex-shrink-0">•</span>
                {obs}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.legislacao_aplicavel?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-2">Legislação Aplicável</h3>
          <div className="flex flex-wrap gap-1.5">
            {result.legislacao_aplicavel.map((lei, i) => (
              <span key={i} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">{lei}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Upload Modal ───────────────────────────────────────────────────────────────

function UploadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [docType, setDocType] = useState("lei_complementar");
  const [scope, setScope] = useState("municipal");
  const [municipio, setMunicipio] = useState("");
  const [estado, setEstado] = useState("");
  const [numero, setNumero] = useState("");
  const [ano, setAno] = useState("");
  const [descricao, setDescricao] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setError("Nome é obrigatório."); return; }
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("doc_type", docType);
      fd.append("scope", scope);
      if (municipio) fd.append("municipio", municipio);
      if (estado) fd.append("estado", estado);
      if (numero) fd.append("numero", numero);
      if (ano) fd.append("ano", ano);
      if (descricao) fd.append("descricao", descricao);
      if (file) fd.append("file", file);
      await api.post("/legal-docs", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">Novo Documento Legislativo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Plano Diretor de São Paulo — Lei 16.050/2014"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
              >
                {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Âmbito</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
              >
                {SCOPE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Número</label>
              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex: 16.050"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ano</label>
              <input
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                placeholder="Ex: 2014"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
              />
            </div>
          </div>

          {scope !== "federal" && (
            <div className="grid grid-cols-2 gap-3">
              {scope === "municipal" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Município</label>
                  <input
                    value={municipio}
                    onChange={(e) => setMunicipio(e.target.value)}
                    placeholder="Ex: São Paulo"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estado (UF)</label>
                <input
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  placeholder="Ex: SP"
                  maxLength={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrição / Ementa</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Breve descrição do conteúdo relevante..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Arquivo (PDF ou imagem) — opcional
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 w-full justify-center"
            >
              <Upload size={15} />
              {file ? file.name : "Selecionar arquivo..."}
            </button>
            {file && (
              <p className="text-xs text-gray-400 mt-1 text-center">
                {(file.size / 1024 / 1024).toFixed(1)} MB — a IA poderá ler o conteúdo completo
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-4">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function LegislacaoPage() {
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);

  const { data: docs = [], isLoading } = useQuery<LegalDoc[]>({
    queryKey: ["legal-docs"],
    queryFn: async () => (await api.get<LegalDoc[]>("/legal-docs")).data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/legal-docs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["legal-docs"] }),
  });

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Remover "${name}" do banco de leis?`)) return;
    deleteMutation.mutate(id);
  };

  const groupedDocs = docs.reduce<Record<string, LegalDoc[]>>((acc, d) => {
    const key = d.scope_label;
    (acc[key] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={22} className="text-primary-600" />
            <h1 className="text-xl font-bold text-gray-900">Banco de Legislação</h1>
          </div>
          <p className="text-sm text-gray-500">
            Cadastre leis, decretos, resoluções do CNJ e planos diretores para que a IA analise
            a legislação e gere a lista de documentos necessários para cada procedimento.
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg flex-shrink-0"
        >
          <Plus size={15} />
          Novo documento
        </button>
      </div>

      {/* Consulta IA */}
      <div className="mb-6">
        <ConsultPanel docs={docs} />
      </div>

      {/* Lista de documentos */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <FileText size={16} className="text-gray-400" />
          <h2 className="text-sm font-bold text-gray-700">
            Documentos cadastrados ({docs.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="animate-spin text-gray-300 mx-auto" />
          </div>
        ) : docs.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Nenhum documento cadastrado.</p>
            <p className="text-gray-300 text-xs mt-1">
              Adicione leis, resoluções e normas para habilitar a consulta com IA.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {Object.entries(groupedDocs).map(([scopeLabel, items]) => (
              <div key={scopeLabel}>
                <div className="px-6 py-2 bg-gray-50">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{scopeLabel}</span>
                </div>
                {items.map((doc) => (
                  <div key={doc.id} className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50">
                    <FileText size={16} className="text-gray-300 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{doc.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${scopeCls[doc.scope] ?? "bg-gray-100 text-gray-500"}`}>
                          {doc.doc_type_label}
                        </span>
                        {doc.has_file && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">PDF</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {doc.numero && <span className="text-xs text-gray-400">Nº {doc.numero}</span>}
                        {doc.ano && <span className="text-xs text-gray-400">{doc.ano}</span>}
                        {doc.municipio && <span className="text-xs text-gray-400">{doc.municipio}/{doc.estado}</span>}
                      </div>
                      {doc.descricao && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{doc.descricao}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id, doc.name)}
                      disabled={deleteMutation.isPending && deleteMutation.variables === doc.id}
                      className="text-gray-300 hover:text-red-500 disabled:opacity-40 transition-colors flex-shrink-0 mt-0.5"
                      title="Remover"
                    >
                      {deleteMutation.isPending && deleteMutation.variables === doc.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["legal-docs"] })}
        />
      )}
    </div>
  );
}
