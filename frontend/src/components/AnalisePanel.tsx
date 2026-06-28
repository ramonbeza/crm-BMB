import { useState } from "react";
import {
  AlertTriangle, ChevronDown, ChevronUp,
  ShieldAlert, ShieldCheck, ShieldQuestion,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Onus {
  tipo: string;
  descricao: string;
  data_registro: string | null;
  credor_beneficiario: string | null;
  situacao: "ativo" | "cancelado" | "incerto";
}

export interface Transmissao {
  ordem: number;
  tipo: string;
  de: string;
  para: string;
  data: string | null;
  valor: string | null;
}

export interface Inconsistencia {
  tipo: string;
  descricao: string;
  gravidade: "baixa" | "media" | "alta";
}

export interface Analise {
  situacao_geral: "regular" | "com_onus" | "irregular" | "requer_investigacao";
  nivel_risco: "baixo" | "medio" | "alto";
  resumo: string;
  onus_reais: Onus[];
  historico_transmissoes: Transmissao[];
  inconsistencias: Inconsistencia[];
  documentos_recomendados: string[];
  recomendacoes: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const situacaoConfig = {
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

// ── Component ─────────────────────────────────────────────────────────────────

export function AnalisePanel({ analise }: { analise: Analise }) {
  const [showTransmissoes, setShowTransmissoes] = useState(false);
  const cfg = situacaoConfig[analise.situacao_geral] ?? situacaoConfig.requer_investigacao;
  const Icon = cfg.icon;
  const risco = riscoLabel[analise.nivel_risco] ?? riscoLabel.medio;

  return (
    <div className="space-y-4">
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
