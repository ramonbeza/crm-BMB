import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { PaginatedProperties } from "@/types";

interface FormState {
  matricula: string;
  inscricao_imobiliaria: string;
  incra_code: string;
  property_type: string;
  endereco: string;
  area_total: string;
  area_unit: string;
  cartorio: string;
  confrontantes: string;
  notas: string;
}

const emptyForm = (): FormState => ({
  matricula: "",
  inscricao_imobiliaria: "",
  incra_code: "",
  property_type: "urbano",
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

export function PropertiesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

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
        endereco: f.endereco || null,
        area_total: f.area_total ? parseFloat(f.area_total) : null,
        area_unit: f.area_unit,
        cartorio: f.cartorio || null,
        confrontantes: f.confrontantes || null,
        notas: f.notas || null,
        owners: [],
      };
      return (await api.post("/properties", payload)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      setOpen(false);
      setForm(emptyForm());
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
          onClick={() => { setForm(emptyForm()); setOpen(true); }}
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
