import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle, AlertTriangle, ChevronDown, ChevronUp,
  FileCheck, FileText, FileX, Loader2, Trash2, Upload,
} from "lucide-react";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtractedDoc {
  id: string;
  procedure_id: string | null;
  property_id: string | null;
  filename: string;
  doc_type: string | null;
  doc_type_label: string | null;
  extracted_data: Record<string, unknown> | null;
  status: "extraido" | "erro";
  error_message: string | null;
  created_at: string;
}

// ── Icons por tipo ────────────────────────────────────────────────────────────

const DOC_TYPE_COLORS: Record<string, string> = {
  certidao_matricula: "bg-blue-50 text-blue-700 border-blue-200",
  certidao_negativa_debitos: "bg-green-50 text-green-700 border-green-200",
  certidao_obito: "bg-gray-50 text-gray-600 border-gray-200",
  certidao_casamento: "bg-pink-50 text-pink-700 border-pink-200",
  certidao_nascimento: "bg-sky-50 text-sky-700 border-sky-200",
  planta_aprovada: "bg-violet-50 text-violet-700 border-violet-200",
  memorial_descritivo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  contrato_compra_venda: "bg-amber-50 text-amber-700 border-amber-200",
  contrato_honorarios: "bg-orange-50 text-orange-700 border-orange-200",
  escritura_publica: "bg-yellow-50 text-yellow-700 border-yellow-200",
  habite_se: "bg-emerald-50 text-emerald-700 border-emerald-200",
  auto_vistoria_cbm: "bg-red-50 text-red-700 border-red-200",
  procuracao: "bg-purple-50 text-purple-700 border-purple-200",
  alvara_construcao: "bg-lime-50 text-lime-700 border-lime-200",
  art_rrt: "bg-teal-50 text-teal-700 border-teal-200",
  ccir: "bg-cyan-50 text-cyan-700 border-cyan-200",
  itr: "bg-cyan-50 text-cyan-700 border-cyan-200",
  formal_partilha: "bg-rose-50 text-rose-700 border-rose-200",
  convenio_condominio: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  laudo_avaliacao: "bg-slate-50 text-slate-700 border-slate-200",
};

function docCls(type: string | null) {
  return type ? (DOC_TYPE_COLORS[type] ?? "bg-gray-50 text-gray-600 border-gray-200") : "bg-gray-50 text-gray-400 border-gray-200";
}

// ── Renderiza campos extraídos ────────────────────────────────────────────────

function FieldGrid({ data }: { data: Record<string, unknown> }) {
  const skip = new Set(["doc_type", "doc_type_label", "resumo", "campos", "partes", "imovel", "alertas", "observacoes"]);

  const topFields = Object.entries(data)
    .filter(([k, v]) => !skip.has(k) && v != null && v !== "" && !Array.isArray(v) && typeof v !== "object")
    .map(([k, v]) => ({ label: k.replace(/_/g, " "), value: String(v) }));

  const campos = data.campos as Record<string, unknown> | null;
  const camposFields = campos
    ? Object.entries(campos)
        .filter(([, v]) => v != null && v !== "" && !Array.isArray(v) && typeof v !== "object")
        .map(([k, v]) => ({ label: k.replace(/_/g, " "), value: String(v) }))
    : [];

  const allFields = [...topFields, ...camposFields];

  const partes = data.partes as Array<Record<string, string>> | null;
  const imovel = data.imovel as Record<string, string> | null;
  const alertas = data.alertas as string[] | null;
  const obs = data.observacoes as string | null;

  return (
    <div className="space-y-3 mt-3">
      {allFields.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
          {allFields.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">{label}</p>
              <p className="text-xs text-gray-800 mt-0.5 break-words">{value}</p>
            </div>
          ))}
        </div>
      )}

      {partes && partes.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">Partes</p>
          <div className="space-y-1">
            {partes.map((parte, i) => (
              <div key={i} className="text-xs text-gray-700 flex gap-2">
                <span className="text-gray-400 flex-shrink-0 capitalize">{parte.papel ?? "parte"}:</span>
                <span className="font-medium">{parte.nome}</span>
                {parte.cpf_cnpj && <span className="text-gray-400">{parte.cpf_cnpj}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {imovel && Object.values(imovel).some(Boolean) && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">Imóvel</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {Object.entries(imovel).filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <span className="text-[10px] text-gray-400 capitalize">{k.replace(/_/g, " ")}: </span>
                <span className="text-xs text-gray-800">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {alertas && alertas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {alertas.map((a, i) => (
            <span key={i} className="flex items-center gap-1 text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              <AlertTriangle size={10} />
              {a}
            </span>
          ))}
        </div>
      )}

      {obs && (
        <p className="text-xs text-gray-500 italic border-t border-gray-100 pt-2">{obs}</p>
      )}
    </div>
  );
}

// ── Card de documento ─────────────────────────────────────────────────────────

function DocCard({ doc, onDelete }: { doc: ExtractedDoc; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remover "${doc.filename}"?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/documents/${doc.id}`);
      onDelete();
    } finally {
      setDeleting(false);
    }
  };

  const isError = doc.status === "erro";
  const alertas = (doc.extracted_data?.alertas as string[] | null) ?? [];

  return (
    <div className={`border rounded-lg overflow-hidden ${isError ? "border-red-200 bg-red-50/30" : "border-gray-200 bg-white"}`}>
      <div
        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50/60 transition-colors"
        onClick={() => !isError && setOpen((o) => !o)}
      >
        {/* Type badge */}
        <div className={`flex-shrink-0 mt-0.5 px-2 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wide ${docCls(doc.doc_type)}`}>
          {doc.doc_type_label ?? (isError ? "Erro" : "Desconhecido")}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{doc.filename}</p>
          {doc.extracted_data?.resumo != null && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
              {String(doc.extracted_data.resumo)}
            </p>
          )}
          {isError && (
            <p className="text-xs text-red-600 mt-0.5">{doc.error_message}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {alertas.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full">
              <AlertTriangle size={9} />
              {alertas.length}
            </span>
          )}
          <span className="text-[10px] text-gray-400">
            {new Date(doc.created_at).toLocaleDateString("pt-BR")}
          </span>
          {!isError && (
            <span className="text-gray-300">
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-gray-300 hover:text-red-400 transition-colors ml-1"
            title="Remover"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>

      {open && doc.extracted_data && (
        <div className="px-3 pb-3 border-t border-gray-100">
          <FieldGrid data={doc.extracted_data} />
        </div>
      )}
    </div>
  );
}

// ── Painel principal ──────────────────────────────────────────────────────────

interface Props {
  procedureId?: string;
  propertyId?: string;
}

export function ExtractedDocumentsPanel({ procedureId, propertyId }: Props) {
  const queryKey = ["extracted-docs", procedureId, propertyId];
  const { data: docs, refetch } = useQuery<ExtractedDoc[]>({
    queryKey,
    queryFn: async () => {
      const params = procedureId ? `procedure_id=${procedureId}` : `property_id=${propertyId}`;
      return (await api.get<ExtractedDoc[]>(`/documents?${params}`)).data;
    },
    enabled: !!(procedureId || propertyId),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("files", f);
      const params = procedureId ? `procedure_id=${procedureId}` : `property_id=${propertyId}`;
      await api.post<ExtractedDoc[]>(`/documents/extract?${params}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await refetch();
    } catch {
      setUploadError("Não foi possível extrair os documentos. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  const allDocs = docs ?? [];
  const grouped = allDocs.reduce<Record<string, ExtractedDoc[]>>((acc, d) => {
    const key = d.doc_type_label ?? (d.status === "erro" ? "⚠ Erro na extração" : "Outros");
    (acc[key] = acc[key] ?? []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) handleUpload(e.target.files); e.target.value = ""; }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {uploading ? "Extraindo..." : "Carregar documentos"}
        </button>
        <span className="text-xs text-gray-400">PDF ou imagem · múltiplos arquivos · máx 20 MB cada</span>
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={15} />
          {uploadError}
        </div>
      )}

      {uploading && (
        <div className="py-6 flex flex-col items-center gap-2 text-primary-600">
          <Loader2 size={24} className="animate-spin" />
          <p className="text-sm">Lendo e classificando os documentos com IA...</p>
        </div>
      )}

      {/* Doc list */}
      {!uploading && allDocs.length === 0 && (
        <div className="py-10 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
          <FileText size={28} className="mx-auto mb-2 text-gray-300" />
          Nenhum documento extraído ainda.
          <br />
          <span className="text-xs">Carregue certidões, plantas, contratos ou outros documentos e a IA identifica e extrai as informações.</span>
        </div>
      )}

      {!uploading && allDocs.length > 0 && (
        <div className="space-y-4">
          {Object.entries(grouped).map(([label, group]) => (
            <div key={label}>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                {label.startsWith("⚠") ? (
                  <FileX size={13} className="text-red-400" />
                ) : (
                  <FileCheck size={13} className="text-primary-400" />
                )}
                {label}
                <span className="text-gray-300">({group.length})</span>
              </h4>
              <div className="space-y-2">
                {group.map((doc) => (
                  <DocCard key={doc.id} doc={doc} onDelete={() => refetch()} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
