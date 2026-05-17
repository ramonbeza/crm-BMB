import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import type {
  PaginatedProcedures,
  ProcedureTypeOption,
  PaginatedClients,
  ProcedureStatus,
} from "@/types";
import { formatDate } from "@/lib/utils";

const statusLabel: Record<ProcedureStatus, string> = {
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
const statusCls: Record<ProcedureStatus, string> = {
  em_andamento: "bg-blue-50 text-blue-700",
  concluido: "bg-green-50 text-green-700",
  cancelado: "bg-gray-100 text-gray-500",
};

interface FormState {
  client_id: string;
  procedure_type: string;
  opened_at: string;
  requerente: string;
  matricula: string;
  property_description: string;
  deadline: string;
  tags: string;
}

const emptyForm = (): FormState => ({
  client_id: "",
  procedure_type: "",
  opened_at: new Date().toISOString().slice(0, 10),
  requerente: "",
  matricula: "",
  property_description: "",
  deadline: "",
  tags: "",
});

export function ProceduresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [clientSearch, setClientSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data } = useQuery({
    queryKey: ["procedures", statusFilter],
    queryFn: async () =>
      (await api.get<PaginatedProcedures>(`/procedures/?page_size=100${statusFilter ? `&status=${statusFilter}` : ""}`)).data,
  });

  const { data: types } = useQuery({
    queryKey: ["procedure-types"],
    queryFn: async () => (await api.get<ProcedureTypeOption[]>("/procedures/types")).data,
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-picker", clientSearch],
    queryFn: async () =>
      (await api.get<PaginatedClients>(`/clients?page_size=10&search=${encodeURIComponent(clientSearch)}`)).data,
    enabled: open,
  });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        client_id: f.client_id,
        procedure_type: f.procedure_type,
        opened_at: f.opened_at,
        requerente: f.requerente || null,
        matricula: f.matricula || null,
        property_description: f.property_description || null,
        deadline: f.deadline || null,
        tags: f.tags ? f.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      };
      return (await api.post("/procedures/", payload)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procedures"] });
      setOpen(false);
      setForm(emptyForm());
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procedimentos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data ? `${data.total} protocolo(s)` : "Carregando..."}
          </p>
        </div>
        <button
          onClick={() => { setForm(emptyForm()); setClientSearch(""); setOpen(true); }}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          Novo Procedimento
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">Todos os status</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluido">Concluído</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!data ? (
          <div className="py-16 text-center text-gray-400 text-sm">Carregando...</div>
        ) : data.items.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">Nenhum procedimento.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Protocolo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Etapas</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Prazo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/procedimentos/${p.id}`}
                      className="text-primary-700 hover:text-primary-900 font-mono font-medium"
                    >
                      #{String(p.protocol_number).padStart(4, "0")}
                    </Link>
                    {p.tags.map((t) => (
                      <span key={t} className="ml-1 inline-block px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-medium">
                        {t}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.client_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{p.procedure_type_label}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.stages_done}/{p.stages_total}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{p.deadline ? formatDate(p.deadline) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusCls[p.status]}`}>
                      {statusLabel[p.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Novo Procedimento</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <input
                  placeholder="Buscar cliente..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
                />
                <select
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">— selecione —</option>
                  {clients?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name} ({c.document})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de procedimento *</label>
                <select
                  value={form.procedure_type}
                  onChange={(e) => setForm({ ...form, procedure_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">— selecione —</option>
                  {types?.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de abertura *</label>
                  <input
                    type="date"
                    value={form.opened_at}
                    onChange={(e) => setForm({ ...form, opened_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prazo</label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requerente / Proprietário</label>
                <input
                  value={form.requerente}
                  onChange={(e) => setForm({ ...form, requerente: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula</label>
                <input
                  value={form.matricula}
                  onChange={(e) => setForm({ ...form, matricula: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do imóvel</label>
                <textarea
                  rows={2}
                  value={form.property_description}
                  onChange={(e) => setForm({ ...form, property_description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Etiquetas (separadas por vírgula)
                </label>
                <input
                  placeholder="urgente, prioritário"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {save.isError && (
                <p className="text-red-600 text-sm">Erro ao salvar. Selecione cliente e tipo.</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => save.mutate(form)}
                  disabled={save.isPending || !form.client_id || !form.procedure_type}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm"
                >
                  {save.isPending ? "Criando..." : "Criar (gera 8 etapas)"}
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
