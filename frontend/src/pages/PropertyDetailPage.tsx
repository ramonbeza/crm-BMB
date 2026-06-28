import { useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle, ArrowLeft, Building2, FileText,
  FolderOpen, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion, AlertTriangle,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Property, PaginatedProcedures } from "@/types";

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

// ── Análise jurídica ──────────────────────────────────────────────────────────

interface Onus {
  tipo: string;
  descricao: string;
  data_registro: string | null;
  credor_beneficiario: string | null;
  situacao: "ativo" | "cancelado" | "incerto";
}

interface Transmissao {
  ordem: number;
  tipo: string;
  de: string;
  para: string;
  data: string | null;
  valor: string | null;
}

interface Inconsistencia {
  tipo: string;
  descricao: string;
  gravidade: "baixa" | "media" | "alta";
}

interface Analise {
  situacao_geral: "regular" | "com_onus" | "irregular" | "requer_investigacao";
  nivel_risco: "baixo" | "medio" | "alto";
  resumo: string;
  onus_reais: Onus[];
  historico_transmissoes: Transmissao[];
  inconsistencias: Inconsistencia[];
  documentos_recomendados: string[];
  recomendacoes: string[];
}

const situacaoConfig = {
  regular: { label: "Regular", icon: ShieldCheck, cls: "text-green-600 bg-green-50 border-green-200" },
  com_onus: { label: "Com ônus", icon: ShieldAlert, cls: "text-amber-600 bg-amber-50 border-amber-200" },
  irregular: { label: "Irregular", icon: AlertTriangle, cls: "text-red-600 bg-red-50 border-red-200" },
  requer_investigacao: { label: "Requer investigação", icon: ShieldQuestion, cls: "text-blue-600 bg-blue-50 border-blue-200" },
};

const riscoLabel = {
  baixo: { label: "Risco Baixo", cls: "bg-green-100 text-green-700" },
  medio: { label: "Risco Médio", cls: "bg-amber-100 text-amber-700" },
  alto: { label: "Risco Alto", cls: "bg-red-100 text-red-700" },
};

const gravidadeCls = {
  baixa: "bg-green-50 text-green-700 border border-green-200",
  media: "bg-amber-50 text-amber-700 border border-amber-200",
  alta: "bg-red-50 text-red-700 border border-red-200",
};

const onusCls = {
  ativo: "bg-red-50 text-red-700",
  cancelado: "bg-gray-50 text-gray-500",
  incerto: "bg-amber-50 text-amber-700",
};

function AnalisePanel({ analise }: { analise: Analise }) {
  const [showTransmissoes, setShowTransmissoes] = useState(false);
  const cfg = situacaoConfig[analise.situacao_geral] ?? situacaoConfig.requer_investigacao;
  const Icon = cfg.icon;
  const risco = riscoLabel[analise.nivel_risco] ?? riscoLabel.medio;

  return (
    <div className="space-y-4">
      {/* Situação geral */}
      <div className={`flex items-start gap-3 p-4 rounded-lg border ${cfg.cls}`}>
        <Icon size={22} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">{cfg.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${risco.cls}`}>{risco.label}</span>
          </div>
          <p className="text-sm">{analise.resumo}</p>
        </div>
      </div>

      {/* Ônus reais */}
      {analise.onus_reais.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Ônus e gravames ({analise.onus_reais.length})
          </h4>
          <div className="space-y-2">
            {analise.onus_reais.map((o, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 bg-white">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-800 capitalize">{o.tipo.replace(/_/g, " ")}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${onusCls[o.situacao]}`}>
                    {o.situacao}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{o.descricao}</p>
                {(o.credor_beneficiario || o.data_registro) && (
                  <div className="flex gap-4 mt-1.5 text-xs text-gray-400">
                    {o.credor_beneficiario && <span>Credor/beneficiário: {o.credor_beneficiario}</span>}
                    {o.data_registro && <span>Data: {o.data_registro}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inconsistências */}
      {analise.inconsistencias.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Inconsistências detectadas
          </h4>
          <div className="space-y-2">
            {analise.inconsistencias.map((inc, i) => (
              <div key={i} className={`text-sm rounded-lg px-3 py-2.5 ${gravidadeCls[inc.gravidade]}`}>
                <span className="font-medium capitalize">{inc.tipo.replace(/_/g, " ")}</span>
                {" — "}{inc.descricao}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico de transmissões (colapsável) */}
      {analise.historico_transmissoes.length > 0 && (
        <div>
          <button
            onClick={() => setShowTransmissoes(!showTransmissoes)}
            className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 hover:text-gray-700"
          >
            Histórico de transmissões ({analise.historico_transmissoes.length})
            {showTransmissoes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showTransmissoes && (
            <div className="space-y-2">
              {analise.historico_transmissoes.map((t, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50 text-sm">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono">#{t.ordem}</span>
                    <span className="font-medium text-gray-700 capitalize">{t.tipo}</span>
                    {t.data && <span className="text-xs text-gray-400 ml-auto">{t.data}</span>}
                  </div>
                  <p className="text-gray-600 text-xs">{t.de} → {t.para}</p>
                  {t.valor && <p className="text-xs text-gray-400 mt-0.5">Valor: {t.valor}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Documentos recomendados */}
      {analise.documentos_recomendados.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Documentos recomendados
          </h4>
          <ul className="space-y-1">
            {analise.documentos_recomendados.map((d, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-primary-400 mt-0.5">•</span>{d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recomendações */}
      {analise.recomendacoes.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Recomendações jurídicas
          </h4>
          <ul className="space-y-1.5">
            {analise.recomendacoes.map((r, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-primary-500 font-bold mt-0.5">→</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const fileRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const { data: prop, isLoading } = useQuery<Property>({
    queryKey: ["property", id],
    queryFn: async () => (await api.get<Property>(`/properties/${id}`)).data,
    enabled: !!id,
  });

  const { data: procedures } = useQuery<PaginatedProcedures>({
    queryKey: ["procedures-by-property", id],
    queryFn: async () =>
      (await api.get<PaginatedProcedures>(`/procedures?page_size=100&property_id=${id}`)).data,
    enabled: !!id,
  });

  const handleAnalyze = async (file: File) => {
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalise(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/properties/analyze-matricula", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAnalise(data);
    } catch {
      setAnalyzeError("Não foi possível analisar o documento. Verifique a qualidade e tente novamente.");
    } finally {
      setAnalyzing(false);
    }
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

  return (
    <div className="max-w-4xl mx-auto">
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

        {/* Proprietários registrais */}
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

        {analyzing && (
          <div className="py-8 flex flex-col items-center gap-3 text-primary-600">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-sm">Lendo e analisando a matrícula...</p>
          </div>
        )}

        {analyzeError && (
          <div className="flex items-center gap-2 text-red-600 text-sm py-2">
            <AlertCircle size={16} />
            {analyzeError}
          </div>
        )}

        {analise && !analyzing && <AnalisePanel analise={analise} />}
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

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}
