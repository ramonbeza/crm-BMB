import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, X, Search, Plus, Trash2, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import type { PaginatedProperties } from "@/types";
import { AnalisePanel, situacaoConfig } from "@/components/AnalisePanel";
import type { Analise } from "@/components/AnalisePanel";

interface Proprietario {
  nome: string;
  cpf: string;
  cnpj: string;
  nacionalidade: string;
  estado_civil: string;
  regime_bens: string;
  profissao: string;
  endereco: string;
}

interface FormState {
  matricula: string;
  inscricao_imobiliaria: string;
  incra_code: string;
  property_type: string;
  subtipo: string;
  endereco: string;
  area_total: string;
  area_unit: string;
  cartorio: string;
  confrontantes: string;
  notas: string;
}

const SUBTIPOS = [
  "Apartamento",
  "Casa",
  "Lote urbano",
  "Lote com construção averbada",
  "Sala comercial",
  "Loja",
  "Galpão / armazém",
  "Terreno rural",
  "Terreno rural com benfeitorias",
  "Outro",
];

const emptyProprietario = (): Proprietario => ({
  nome: "",
  cpf: "",
  cnpj: "",
  nacionalidade: "brasileira",
  estado_civil: "",
  regime_bens: "",
  profissao: "",
  endereco: "",
});

const emptyForm = (): FormState => ({
  matricula: "",
  inscricao_imobiliaria: "",
  incra_code: "",
  property_type: "urbano",
  subtipo: "",
  endereco: "",
  area_total: "",
  area_unit: "m2",
  cartorio: "",
  confrontantes: "",
  notas: "",
});

const typeLabel: Record<string, string> = {
  urbano: "Urbano",
  rural: "Rural",
  rural_urbano: "Rural-Urbano",
};

function ProprietarioForm({
  p,
  idx,
  onChange,
  onRemove,
}: {
  p: Proprietario;
  idx: number;
  onChange: (idx: number, field: keyof Proprietario, val: string) => void;
  onRemove: (idx: number) => void;
}) {
  const set = (field: keyof Proprietario) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange(idx, field, e.target.value);

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Proprietário {idx + 1}
        </span>
        <button type="button" onClick={() => onRemove(idx)} className="text-gray-400 hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo</label>
        <input
          value={p.nome}
          onChange={set("nome")}
          placeholder="Nome conforme matrícula"
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">CPF</label>
          <input
            value={p.cpf}
            onChange={set("cpf")}
            placeholder="000.000.000-00"
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">CNPJ (PJ)</label>
          <input
            value={p.cnpj}
            onChange={set("cnpj")}
            placeholder="00.000.000/0000-00"
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nacionalidade</label>
          <input
            value={p.nacionalidade}
            onChange={set("nacionalidade")}
            placeholder="brasileira"
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Profissão</label>
          <input
            value={p.profissao}
            onChange={set("profissao")}
            placeholder="advogado(a)"
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Estado civil</label>
          <select
            value={p.estado_civil}
            onChange={set("estado_civil")}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="">— Selecione —</option>
            <option value="solteiro">Solteiro(a)</option>
            <option value="casado">Casado(a)</option>
            <option value="divorciado">Divorciado(a)</option>
            <option value="viúvo">Viúvo(a)</option>
            <option value="separado">Separado(a)</option>
            <option value="união estável">União estável</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Regime de bens</label>
          <select
            value={p.regime_bens}
            onChange={set("regime_bens")}
            disabled={!["casado", "união estável"].includes(p.estado_civil)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white disabled:opacity-40"
          >
            <option value="">— N/A —</option>
            <option value="comunhão parcial">Comunhão parcial</option>
            <option value="comunhão universal">Comunhão universal</option>
            <option value="separação total">Separação total</option>
            <option value="participação final nos aquestos">Participação final nos aquestos</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Endereço (qualificação)</label>
        <input
          value={p.endereco}
          onChange={set("endereco")}
          placeholder="Rua, número, cidade/UF"
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        />
      </div>
    </div>
  );
}

export function PropertiesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [proprietarios, setProprietarios] = useState<Proprietario[]>([]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExtract = async (file: File) => {
    setExtracting(true);
    setExtractError(null);
    setAnalise(null);
    setAnalyzing(false);
    try {
      // Fase 1 — extração rápida dos dados cadastrais
      const fd1 = new FormData();
      fd1.append("file", file);
      const { data } = await api.post("/properties/extract-matricula", fd1, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm({
        matricula: data.matricula ?? "",
        inscricao_imobiliaria: data.inscricao_imobiliaria ?? "",
        incra_code: data.incra_code ?? "",
        property_type: data.property_type ?? "urbano",
        subtipo: data.subtipo ?? "",
        endereco: data.endereco ?? "",
        area_total: data.area_total != null ? String(data.area_total) : "",
        area_unit: data.area_unit ?? "m2",
        cartorio: data.cartorio ?? "",
        confrontantes: data.confrontantes ?? "",
        notas: "",
      });
      if (Array.isArray(data.proprietarios) && data.proprietarios.length > 0) {
        setProprietarios(
          data.proprietarios.map((p: Record<string, string | null>) => ({
            nome: p.nome ?? "",
            cpf: p.cpf ?? "",
            cnpj: p.cnpj ?? "",
            nacionalidade: p.nacionalidade ?? "brasileira",
            estado_civil: p.estado_civil ?? "",
            regime_bens: p.regime_bens ?? "",
            profissao: p.profissao ?? "",
            endereco: p.endereco ?? "",
          }))
        );
      }
      setExtracting(false);

      // Fase 2 — análise jurídica em background (não bloqueia o formulário)
      setAnalyzing(true);
      try {
        const fd2 = new FormData();
        fd2.append("file", file);
        const { data: aj } = await api.post("/properties/analyze-matricula", fd2, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setAnalise(aj);
      } catch {
        // silently skip — user can analyze from PropertyDetailPage
      } finally {
        setAnalyzing(false);
      }
    } catch {
      setExtractError("Não foi possível extrair os dados. Verifique o documento e tente novamente.");
      setExtracting(false);
    }
  };

  const updateProprietario = (idx: number, field: keyof Proprietario, val: string) => {
    setProprietarios((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: val } : p)));
  };

  const removeProprietario = (idx: number) => {
    setProprietarios((prev) => prev.filter((_, i) => i !== idx));
  };

  const { data } = useQuery({
    queryKey: ["properties", search],
    queryFn: async () =>
      (await api.get<PaginatedProperties>(`/properties?page_size=100${search ? `&search=${encodeURIComponent(search)}` : ""}`)).data,
  });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        matricula: f.matricula || null,
        inscricao_imobiliaria: f.inscricao_imobiliaria || null,
        incra_code: f.incra_code || null,
        property_type: f.property_type,
        subtipo: f.subtipo || null,
        endereco: f.endereco || null,
        area_total: f.area_total ? parseFloat(f.area_total) : null,
        area_unit: f.area_unit,
        cartorio: f.cartorio || null,
        confrontantes: f.confrontantes || null,
        proprietarios: proprietarios.filter((p) => p.nome.trim()),
        quadro_areas_nbr: null,
        analise_juridica: analise ?? null,
        notas: f.notas || null,
        owners: [],
      };
      return (await api.post("/properties", payload)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      setOpen(false);
      setForm(emptyForm());
      setProprietarios([]);
      setAnalise(null);
    },
  });

  const handleSearch = () => setSearch(searchInput);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Imóveis</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data ? `${data.total} imóvel(is) cadastrado(s)` : "Carregando..."}
          </p>
        </div>
        <button
          onClick={() => { setForm(emptyForm()); setProprietarios([]); setExtractError(null); setAnalise(null); setOpen(true); }}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          Novo Imóvel
        </button>
      </div>

      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar por matrícula, endereço, cartório..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          Buscar
        </button>
        {search && (
          <button
            onClick={() => { setSearch(""); setSearchInput(""); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800"
          >
            Limpar
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!data ? (
          <div className="py-16 text-center text-gray-400 text-sm">Carregando...</div>
        ) : data.items.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">Nenhum imóvel cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Matrícula</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Endereço / Localização</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cartório</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Área</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Procedimentos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/imoveis/${p.id}`}
                      className="text-primary-700 hover:text-primary-900 font-medium font-mono"
                    >
                      {p.matricula ?? <span className="text-gray-400 font-sans font-normal">Sem matrícula</span>}
                    </Link>
                    {p.inscricao_imobiliaria && (
                      <p className="text-xs text-gray-400 mt-0.5">Ins.: {p.inscricao_imobiliaria}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      p.property_type === "urbano" ? "bg-blue-50 text-blue-700" :
                      p.property_type === "rural" ? "bg-green-50 text-green-700" :
                      "bg-amber-50 text-amber-700"
                    }`}>
                      {typeLabel[p.property_type] ?? p.property_type}
                    </span>
                    {(p as any).subtipo && (
                      <p className="text-xs text-gray-500 mt-0.5">{(p as any).subtipo}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{p.endereco ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.cartorio ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {p.area_total != null ? `${p.area_total.toLocaleString("pt-BR")} ${p.area_unit === "ha" ? "ha" : "m²"}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${p.procedure_count > 0 ? "bg-primary-50 text-primary-700" : "bg-gray-50 text-gray-400"}`}>
                      {p.procedure_count} proc.
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Novo Imóvel</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Extração automática via matrícula */}
              <div className="rounded-lg border border-dashed border-primary-300 bg-primary-50 p-4">
                <p className="text-sm font-medium text-primary-800 mb-1">
                  Preencher automaticamente com a matrícula
                </p>
                <p className="text-xs text-primary-600 mb-3">
                  Fase 1 preenche o formulário na hora. A análise jurídica aparece em seguida, em background.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExtract(f); e.target.value = ""; }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={extracting || analyzing}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
                >
                  {extracting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                  {extracting ? "Extraindo dados..." : "Carregar matrícula (PDF ou imagem)"}
                </button>
                {extractError && <p className="text-red-600 text-xs mt-2">{extractError}</p>}
              </div>

              {/* Análise jurídica — loading ou resultado */}
              {analyzing && !analise && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-primary-100 bg-primary-50 text-primary-700 text-sm">
                  <Loader2 size={15} className="animate-spin flex-shrink-0" />
                  Gerando análise jurídica da matrícula...
                </div>
              )}
              {analise && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert size={15} className="text-primary-500" />
                    <h3 className="text-sm font-semibold text-gray-800">Análise Jurídica da Matrícula</h3>
                    <span className="text-xs bg-primary-50 text-primary-600 px-1.5 py-0.5 rounded font-medium">IA</span>
                    {(() => {
                      const cfg = situacaoConfig[analise.situacao_geral] ?? situacaoConfig.requer_investigacao;
                      return (
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ml-auto ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </div>
                  <AnalisePanel analise={analise} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de imóvel *</label>
                  <select
                    value={form.property_type}
                    onChange={(e) => setForm({ ...form, property_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="urbano">Urbano</option>
                    <option value="rural">Rural</option>
                    <option value="rural_urbano">Rural-Urbano</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subtipo / Natureza</label>
                  <select
                    value={SUBTIPOS.includes(form.subtipo) ? form.subtipo : form.subtipo ? "Outro" : ""}
                    onChange={(e) => setForm({ ...form, subtipo: e.target.value === "Outro" ? "" : e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">— Selecione —</option>
                    {SUBTIPOS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {(form.subtipo && !SUBTIPOS.slice(0, -1).includes(form.subtipo)) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Especificar subtipo</label>
                  <input
                    placeholder="Ex: Lote com galpão industrial averbado"
                    value={form.subtipo}
                    onChange={(e) => setForm({ ...form, subtipo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula (CRI)</label>
                  <input
                    placeholder="12.345"
                    value={form.matricula}
                    onChange={(e) => setForm({ ...form, matricula: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inscrição Imobiliária</label>
                  <input
                    placeholder="0000.00.00.000000-0"
                    value={form.inscricao_imobiliaria}
                    onChange={(e) => setForm({ ...form, inscricao_imobiliaria: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {(form.property_type === "rural" || form.property_type === "rural_urbano") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código INCRA</label>
                  <input
                    placeholder="000.000.000.000-0"
                    value={form.incra_code}
                    onChange={(e) => setForm({ ...form, incra_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço / Localização</label>
                <input
                  placeholder="Rua das Flores, 123 — Bairro, Cidade/UF"
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Área total</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0"
                    value={form.area_total}
                    onChange={(e) => setForm({ ...form, area_total: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                  <select
                    value={form.area_unit}
                    onChange={(e) => setForm({ ...form, area_unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="m2">m²</option>
                    <option value="ha">ha</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cartório de Registro competente</label>
                <input
                  placeholder="1º CRI de São Paulo"
                  value={form.cartorio}
                  onChange={(e) => setForm({ ...form, cartorio: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confrontantes (lindeiros)</label>
                <textarea
                  rows={2}
                  placeholder="Norte: João da Silva; Sul: Maria Souza; Leste: Rua das Flores; Oeste: fazenda X"
                  value={form.confrontantes}
                  onChange={(e) => setForm({ ...form, confrontantes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Proprietários registrais */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Proprietários registrais
                    <span className="ml-1 text-xs text-gray-400 font-normal">(conforme averbação mais recente)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setProprietarios((prev) => [...prev, emptyProprietario()])}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium"
                  >
                    <Plus size={13} /> Adicionar
                  </button>
                </div>
                {proprietarios.length === 0 && (
                  <p className="text-xs text-gray-400 py-2">
                    Nenhum proprietário adicionado. Use a extração por IA ou adicione manualmente.
                  </p>
                )}
                <div className="space-y-3">
                  {proprietarios.map((p, idx) => (
                    <ProprietarioForm
                      key={idx}
                      p={p}
                      idx={idx}
                      onChange={updateProprietario}
                      onRemove={removeProprietario}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {save.isError && (
                <p className="text-red-600 text-sm">Erro ao salvar o imóvel.</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => save.mutate(form)}
                  disabled={save.isPending}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm"
                >
                  {save.isPending ? "Salvando..." : "Cadastrar imóvel"}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
