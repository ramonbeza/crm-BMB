import { useRef, useState, useCallback, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, ArrowLeft, Building2, Download, FileText,
  FolderOpen, Loader2, ShieldAlert,
  TableProperties, Plus, Trash2, Save, Upload,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Property, PaginatedProcedures } from "@/types";
import { AnalisePanel } from "@/components/AnalisePanel";
import type { Analise } from "@/components/AnalisePanel";
import { StreamingAnalise } from "@/components/StreamingAnalise";
import { streamAnalysis } from "@/lib/streamAnalysis";
import { useAuthStore } from "@/store/authStore";

const typeLabel: Record<string, string> = {
  urbano: "Urbano",
  rural: "Rural",
  rural_urbano: "Rural-Urbano",
};

const typeCls: Record<string, string> = {
  urbano: "bg-blue-50 text-blue-700",
  rural: "bg-green-50 text-green-700",
  rural_urbano: "bg-amber-50 text-amber-700",
};

const procStatusCls: Record<string, string> = {
  em_andamento: "bg-blue-50 text-blue-700",
  concluido: "bg-green-50 text-green-700",
  cancelado: "bg-gray-100 text-gray-500",
};
const procStatusLabel: Record<string, string> = {
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

// ── NBR 12721 ─────────────────────────────────────────────────────────────────

interface NbrUnidade {
  id_unidade: string;
  tipo: string;
  descricao: string;
  pavimento: string;
  area_privativa_real: number | null;
  area_comum_real: number | null;
  area_total_real: number | null;
  area_privativa_equivalente: number | null;
  area_comum_equivalente: number | null;
  area_total_equivalente: number | null;
  fracao_ideal_terreno: string | null;
  coeficiente_proporcionalidade: number | null;
  dormitorios: number | null;
  vagas: number | null;
  observacoes: string | null;
}

interface NbrQuadro {
  nome_empreendimento?: string | null;
  endereco?: string | null;
  numero_pavimentos?: number | null;
  total_unidades?: number | null;
  unidades: NbrUnidade[];
  totais: {
    area_privativa_real: number;
    area_comum_real: number;
    area_total_real: number;
    area_privativa_equivalente?: number | null;
    area_comum_equivalente?: number | null;
    area_total_equivalente?: number | null;
  };
  observacoes_gerais?: string | null;
}

const TIPO_LABELS: Record<string, string> = {
  apartamento: "Apartamento",
  sala_comercial: "Sala comercial",
  vaga_garagem: "Vaga",
  deposito: "Depósito",
  loja: "Loja",
  outro: "Outro",
};

const newUnidade = (): NbrUnidade => ({
  id_unidade: "",
  tipo: "apartamento",
  descricao: "",
  pavimento: "",
  area_privativa_real: null,
  area_comum_real: null,
  area_total_real: null,
  area_privativa_equivalente: null,
  area_comum_equivalente: null,
  area_total_equivalente: null,
  fracao_ideal_terreno: null,
  coeficiente_proporcionalidade: null,
  dormitorios: null,
  vagas: null,
  observacoes: null,
});

function recalcTotais(unidades: NbrUnidade[]): NbrQuadro["totais"] {
  const sum = (key: keyof NbrUnidade) =>
    unidades.reduce((acc, u) => acc + (Number(u[key]) || 0), 0);
  return {
    area_privativa_real: sum("area_privativa_real"),
    area_comum_real: sum("area_comum_real"),
    area_total_real: sum("area_total_real"),
    area_privativa_equivalente: sum("area_privativa_equivalente"),
    area_comum_equivalente: sum("area_comum_equivalente"),
    area_total_equivalente: sum("area_total_equivalente"),
  };
}

function fmt(val: number | null | undefined) {
  if (val == null) return "—";
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function NbrPanel({
  propertyId,
  initial,
  onSaved,
}: {
  propertyId: string;
  initial: NbrQuadro | null;
  onSaved: () => void;
}) {
  const [quadro, setQuadro] = useState<NbrQuadro>(
    initial ?? { unidades: [newUnidade()], totais: recalcTotais([newUnidade()]) }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const updateUnidade = useCallback((idx: number, field: keyof NbrUnidade, value: string | number | null) => {
    setQuadro((prev) => {
      const unidades = prev.unidades.map((u, i) => {
        if (i !== idx) return u;
        const updated = { ...u, [field]: value };
        // auto-calc area_total_real
        if (field === "area_privativa_real" || field === "area_comum_real") {
          const priv = field === "area_privativa_real" ? (Number(value) || 0) : (Number(u.area_privativa_real) || 0);
          const comum = field === "area_comum_real" ? (Number(value) || 0) : (Number(u.area_comum_real) || 0);
          updated.area_total_real = priv + comum || null;
        }
        if (field === "area_privativa_equivalente" || field === "area_comum_equivalente") {
          const priv = field === "area_privativa_equivalente" ? (Number(value) || 0) : (Number(u.area_privativa_equivalente) || 0);
          const comum = field === "area_comum_equivalente" ? (Number(value) || 0) : (Number(u.area_comum_equivalente) || 0);
          updated.area_total_equivalente = priv + comum || null;
        }
        return updated as NbrUnidade;
      });
      return { ...prev, unidades, totais: recalcTotais(unidades) };
    });
    setSaved(false);
  }, []);

  const addUnidade = () => {
    setQuadro((prev) => {
      const unidades = [...prev.unidades, newUnidade()];
      return { ...prev, unidades, totais: recalcTotais(unidades) };
    });
  };

  const removeUnidade = (idx: number) => {
    setQuadro((prev) => {
      const unidades = prev.unidades.filter((_, i) => i !== idx);
      return { ...prev, unidades, totais: recalcTotais(unidades) };
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/properties/${propertyId}/nbr-areas`, quadro);
      setSaved(true);
      onSaved();
    } catch {
      setError("Erro ao salvar o quadro. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-primary-400 bg-white";

  return (
    <div className="space-y-4">
      {/* Metadados */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Nome do empreendimento</label>
          <input
            className={inputCls}
            value={quadro.nome_empreendimento ?? ""}
            onChange={(e) => { setQuadro((p) => ({ ...p, nome_empreendimento: e.target.value })); setSaved(false); }}
            placeholder="Ex: Residencial das Flores"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Endereço do empreendimento</label>
          <input
            className={inputCls}
            value={quadro.endereco ?? ""}
            onChange={(e) => { setQuadro((p) => ({ ...p, endereco: e.target.value })); setSaved(false); }}
            placeholder="Endereço completo"
          />
        </div>
      </div>

      {/* Tabela de unidades */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left font-semibold text-gray-600 w-16">Unid.</th>
              <th className="px-2 py-2 text-left font-semibold text-gray-600 w-24">Tipo</th>
              <th className="px-2 py-2 text-left font-semibold text-gray-600 w-40">Descrição</th>
              <th className="px-2 py-2 text-left font-semibold text-gray-600 w-24">Pavimento</th>
              <th className="px-2 py-2 text-right font-semibold text-gray-600 w-20">Á. Priv. Real (m²)</th>
              <th className="px-2 py-2 text-right font-semibold text-gray-600 w-20">Á. Comum Real (m²)</th>
              <th className="px-2 py-2 text-right font-semibold text-gray-600 w-20">Á. Total Real (m²)</th>
              <th className="px-2 py-2 text-right font-semibold text-gray-600 w-20">Á. Priv. Equiv. (m²)</th>
              <th className="px-2 py-2 text-right font-semibold text-gray-600 w-20">Á. Total Equiv. (m²)</th>
              <th className="px-2 py-2 text-left font-semibold text-gray-600 w-24">Fração Ideal</th>
              <th className="px-2 py-2 text-center font-semibold text-gray-600 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {quadro.unidades.map((u, idx) => (
              <tr key={idx} className="hover:bg-gray-50/50">
                <td className="px-2 py-1">
                  <input
                    className={inputCls}
                    value={u.id_unidade}
                    onChange={(e) => updateUnidade(idx, "id_unidade", e.target.value)}
                    placeholder="101"
                  />
                </td>
                <td className="px-2 py-1">
                  <select
                    className={inputCls}
                    value={u.tipo}
                    onChange={(e) => updateUnidade(idx, "tipo", e.target.value)}
                  >
                    {Object.entries(TIPO_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <input
                    className={inputCls}
                    value={u.descricao}
                    onChange={(e) => updateUnidade(idx, "descricao", e.target.value)}
                    placeholder="Apartamento 101"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={inputCls}
                    value={u.pavimento}
                    onChange={(e) => updateUnidade(idx, "pavimento", e.target.value)}
                    placeholder="1º Pavimento"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={`${inputCls} text-right`}
                    type="number"
                    step="0.01"
                    value={u.area_privativa_real ?? ""}
                    onChange={(e) => updateUnidade(idx, "area_privativa_real", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="0,00"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={`${inputCls} text-right`}
                    type="number"
                    step="0.01"
                    value={u.area_comum_real ?? ""}
                    onChange={(e) => updateUnidade(idx, "area_comum_real", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="0,00"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={`${inputCls} text-right bg-gray-50`}
                    type="number"
                    step="0.01"
                    value={u.area_total_real ?? ""}
                    onChange={(e) => updateUnidade(idx, "area_total_real", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="auto"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={`${inputCls} text-right`}
                    type="number"
                    step="0.01"
                    value={u.area_privativa_equivalente ?? ""}
                    onChange={(e) => updateUnidade(idx, "area_privativa_equivalente", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="—"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={`${inputCls} text-right bg-gray-50`}
                    type="number"
                    step="0.01"
                    value={u.area_total_equivalente ?? ""}
                    onChange={(e) => updateUnidade(idx, "area_total_equivalente", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="auto"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={inputCls}
                    value={u.fracao_ideal_terreno ?? ""}
                    onChange={(e) => updateUnidade(idx, "fracao_ideal_terreno", e.target.value || null)}
                    placeholder="1/100"
                  />
                </td>
                <td className="px-2 py-1 text-center">
                  <button
                    onClick={() => removeUnidade(idx)}
                    className="text-gray-300 hover:text-red-400 transition-colors"
                    title="Remover unidade"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Totais */}
          <tfoot className="bg-gray-50 border-t-2 border-gray-300">
            <tr>
              <td colSpan={4} className="px-2 py-2 text-xs font-bold text-gray-700">TOTAIS</td>
              <td className="px-2 py-2 text-right text-xs font-bold text-gray-900">{fmt(quadro.totais.area_privativa_real)}</td>
              <td className="px-2 py-2 text-right text-xs font-bold text-gray-900">{fmt(quadro.totais.area_comum_real)}</td>
              <td className="px-2 py-2 text-right text-xs font-bold text-gray-900">{fmt(quadro.totais.area_total_real)}</td>
              <td className="px-2 py-2 text-right text-xs font-bold text-gray-900">{fmt(quadro.totais.area_privativa_equivalente ?? null)}</td>
              <td className="px-2 py-2 text-right text-xs font-bold text-gray-900">{fmt(quadro.totais.area_total_equivalente ?? null)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Observações gerais */}
      <div>
        <label className="block text-xs text-gray-500 mb-0.5">Observações gerais</label>
        <textarea
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary-400 resize-none"
          rows={2}
          value={quadro.observacoes_gerais ?? ""}
          onChange={(e) => { setQuadro((p) => ({ ...p, observacoes_gerais: e.target.value })); setSaved(false); }}
          placeholder="Observações sobre o quadro de áreas..."
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={addUnidade}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium rounded-lg"
        >
          <Plus size={14} />
          Adicionar unidade
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? "Salvo!" : "Salvar quadro"}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const nbrFileRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const accessToken = useAuthStore((s) => s.accessToken);
  const [streamText, setStreamText] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!id || !accessToken) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/${id}/pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Erro ao gerar PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? `imovel_${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Não foi possível gerar o PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const { data: prop, isLoading } = useQuery<Property>({
    queryKey: ["property", id],
    queryFn: async () => (await api.get<Property>(`/properties/${id}`)).data,
    enabled: !!id,
  });

  // Hydrate saved analysis from property (set at registration time via extract-full)
  useEffect(() => {
    if (prop && (prop as any).analise_juridica && !analise) {
      setAnalise((prop as any).analise_juridica as Analise);
    }
  }, [prop]);

  const { data: procedures } = useQuery<PaginatedProcedures>({
    queryKey: ["procedures-by-property", id],
    queryFn: async () =>
      (await api.get<PaginatedProcedures>(`/procedures?page_size=100&property_id=${id}`)).data,
    enabled: !!id,
  });

  const handleAnalyze = (file: File) => {
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalise(null);
    setStreamText("");

    streamAnalysis(
      file,
      accessToken,
      (chunk) => setStreamText((t) => t + chunk),
      (fullText) => {
        setAnalyzing(false);
        const clean = fullText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
        try {
          setAnalise(JSON.parse(clean) as Analise);
        } catch {
          setAnalyzeError("Análise recebida mas não foi possível interpretar o resultado.");
        }
        setStreamText("");
      },
      (msg) => {
        setAnalyzing(false);
        setAnalyzeError(msg);
        setStreamText("");
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    );
  }

  if (!prop) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="text-red-400" size={32} />
        <p className="text-gray-500 text-sm">Imóvel não encontrado.</p>
        <Link to="/imoveis" className="text-primary-600 text-sm hover:underline">← Voltar</Link>
      </div>
    );
  }

  const quadroSalvo = (prop as any).quadro_areas_nbr as NbrQuadro | null;

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        to="/imoveis"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5"
      >
        <ArrowLeft size={16} />
        Imóveis
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Building2 size={22} className="text-gray-400" />
            <h1 className="text-xl font-bold text-gray-900 font-mono">
              {prop.matricula ?? <span className="text-gray-400 font-sans font-normal italic">Sem matrícula registrada</span>}
            </h1>
            <span className={`inline-flex px-2.5 py-1 rounded text-xs font-semibold ${typeCls[prop.property_type]}`}>
              {typeLabel[prop.property_type]}
            </span>
            {(prop as any).subtipo && (
              <span className="inline-flex px-2.5 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                {(prop as any).subtipo}
              </span>
            )}
          </div>
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium rounded-lg"
            title="Baixar relatório completo em PDF"
          >
            {downloadingPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {downloadingPdf ? "Gerando..." : "Baixar PDF"}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3">
          {prop.inscricao_imobiliaria && (
            <InfoField label="Inscrição Imobiliária" value={prop.inscricao_imobiliaria} />
          )}
          {prop.incra_code && (
            <InfoField label="Código INCRA" value={prop.incra_code} />
          )}
          {prop.endereco && (
            <InfoField label="Endereço / Localização" value={prop.endereco} />
          )}
          {prop.area_total != null && (
            <InfoField
              label="Área total"
              value={`${prop.area_total.toLocaleString("pt-BR")} ${prop.area_unit === "ha" ? "ha" : "m²"}`}
            />
          )}
          {prop.cartorio && (
            <InfoField label="Cartório de Registro" value={prop.cartorio} />
          )}
          <InfoField label="Procedimentos" value={String(prop.procedure_count)} />
        </div>

        {prop.confrontantes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1">Confrontantes (lindeiros)</p>
            <p className="text-sm text-gray-700">{prop.confrontantes}</p>
          </div>
        )}

        {(prop as any).proprietarios?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">Proprietários registrais</p>
            <div className="space-y-2">
              {(prop as any).proprietarios.map((p: any, i: number) => (
                <div key={i} className="text-sm">
                  <span className="font-medium text-gray-800">{p.nome}</span>
                  {p.cpf && <span className="text-gray-400 ml-2 text-xs">CPF: {p.cpf}</span>}
                  {p.cnpj && <span className="text-gray-400 ml-2 text-xs">CNPJ: {p.cnpj}</span>}
                  <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                    {p.nacionalidade && <span>{p.nacionalidade}</span>}
                    {p.estado_civil && <span>{p.estado_civil}{p.regime_bens ? ` — ${p.regime_bens}` : ""}</span>}
                    {p.profissao && <span>{p.profissao}</span>}
                    {p.endereco && <span>{p.endereco}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {prop.notas && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1">Observações</p>
            <p className="text-sm text-gray-700">{prop.notas}</p>
          </div>
        )}
      </div>

      {/* Quadro de Áreas NBR 12721 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TableProperties size={18} className="text-primary-500" />
            <h2 className="text-base font-bold text-gray-900">Quadro de Áreas</h2>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-medium">NBR 12.721</span>
            {quadroSalvo && (
              <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded font-medium">
                {(quadroSalvo.unidades?.length ?? 0)} unidades salvas
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={nbrFileRef}
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) { /* handled in NbrPanel */ } e.target.value = ""; }}
            />
          </div>
        </div>

        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 mb-4">
          <Upload size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Use o botão abaixo para importar plantas e documentos — a IA extrai automaticamente todas as unidades e áreas no formato NBR 12.721.
            Você pode editar os valores antes de salvar.
          </p>
        </div>

        <NbrPanelWithUpload propertyId={id!} initial={quadroSalvo} onSaved={() => queryClient.invalidateQueries({ queryKey: ["property", id] })} />
      </div>

      {/* Análise Jurídica com IA */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-primary-500" />
            <h2 className="text-base font-bold text-gray-900">Análise Jurídica da Matrícula</h2>
            <span className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded font-medium">IA</span>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAnalyze(f); e.target.value = ""; }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              {analyzing ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              {analyzing ? "Analisando..." : analise ? "Nova análise" : "Analisar matrícula"}
            </button>
          </div>
        </div>

        {!analise && !analyzing && !analyzeError && (
          <p className="text-sm text-gray-400 py-4 text-center">
            Faça upload da matrícula (PDF ou imagem) para gerar um parecer jurídico com IA —<br />
            ônus, transmissões, inconsistências e recomendações.
          </p>
        )}
        {analise && !analyzing && (prop as any).analise_juridica && (
          <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Análise gerada automaticamente no cadastro. Clique em "Nova análise" para atualizar.
          </p>
        )}

        {(analyzing || streamText) && !analise && (
          <div className="py-4">
            <StreamingAnalise streamText={streamText} isStreaming={analyzing} analise={null} />
          </div>
        )}

        {analyzing && !streamText && (
          <div className="py-8 flex flex-col items-center gap-3 text-primary-600">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-sm">Conectando ao Claude...</p>
          </div>
        )}

        {analyzeError && (
          <div className="flex items-center gap-2 text-red-600 text-sm py-2">
            <AlertCircle size={16} />
            {analyzeError}
          </div>
        )}

        {analise && !analyzing && !streamText && <AnalisePanel analise={analise} />}
      </div>

      {/* Procedures linked to this property */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen size={18} className="text-gray-400" />
          <h2 className="text-base font-bold text-gray-900">Procedimentos vinculados</h2>
          <span className="ml-auto text-xs text-gray-400">{procedures?.total ?? 0} total</span>
        </div>

        {!procedures || procedures.items.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            Nenhum procedimento vinculado a este imóvel.
            <br />
            <span className="text-xs">Ao criar um procedimento, selecione este imóvel para vinculá-lo.</span>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {procedures.items.map((p) => {
              const year = new Date(p.opened_at).getFullYear();
              const proto = `BMB-${year}-${String(p.protocol_number).padStart(4, "0")}`;
              return (
                <div key={p.id} className="flex items-center gap-4 py-3">
                  <Link
                    to={`/procedimentos/${p.id}`}
                    className="font-mono text-sm font-medium text-primary-700 hover:text-primary-900 w-36 flex-shrink-0"
                  >
                    {proto}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{p.procedure_type_label}</p>
                    <p className="text-xs text-gray-400">{p.client_name ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400">
                      {p.stages_done}/{p.stages_total} etapas
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${procStatusCls[p.status]}`}>
                      {procStatusLabel[p.status]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── NbrPanelWithUpload — wrapper que gerencia o upload e passa para NbrPanel ──

function NbrPanelWithUpload({
  propertyId,
  initial,
  onSaved,
}: {
  propertyId: string;
  initial: NbrQuadro | null;
  onSaved: () => void;
}) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<NbrQuadro | null>(null);

  const handleFiles = async (files: FileList) => {
    if (!files.length) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("files", f);
      const { data } = await api.post<NbrQuadro>(
        `/properties/${propertyId}/extract-nbr-areas`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const unidades = data.unidades ?? [];
      setExtracted({ ...data, unidades, totais: recalcTotais(unidades) });
    } catch {
      setExtractError("Não foi possível extrair o quadro. Verifique os arquivos e tente novamente.");
    } finally {
      setExtracting(false);
    }
  };

  const active = extracted ?? initial;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={uploadRef}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
        />
        <button
          onClick={() => uploadRef.current?.click()}
          disabled={extracting}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          {extracting ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {extracting ? "Extraindo áreas..." : "Importar planta / documentos"}
        </button>
        <span className="text-xs text-gray-400">PDF ou imagem · múltiplos arquivos · máx 20 MB cada</span>
      </div>

      {extracting && (
        <div className="py-6 flex flex-col items-center gap-2 text-primary-600">
          <Loader2 size={24} className="animate-spin" />
          <p className="text-sm">Lendo plantas e extraindo o quadro de áreas...</p>
        </div>
      )}

      {extractError && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={15} />
          {extractError}
        </div>
      )}

      {!extracting && (
        <NbrPanel propertyId={propertyId} initial={active} onSaved={onSaved} />
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}
