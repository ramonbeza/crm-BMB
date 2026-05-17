import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Check } from "lucide-react";
import { api } from "@/lib/api";
import type {
  Attendance,
  PaginatedAttendances,
  PaginatedClients,
  PaginatedMeetings,
} from "@/types";
import { formatDate } from "@/lib/utils";

interface FormState {
  id?: string;
  client_id: string;
  meeting_id: string;
  decisions: string;
  pending_items: string;
  converted_to_procedure: boolean;
}

const emptyForm = (): FormState => ({
  client_id: "",
  meeting_id: "",
  decisions: "",
  pending_items: "",
  converted_to_procedure: false,
});

export function AttendancesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "pending">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [clientSearch, setClientSearch] = useState("");

  const endpoint = tab === "pending" ? "/attendances/pending-procedures" : "/attendances/";
  const { data } = useQuery({
    queryKey: ["attendances", tab],
    queryFn: async () => (await api.get<PaginatedAttendances>(`${endpoint}?page_size=100`)).data,
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-picker", clientSearch],
    queryFn: async () =>
      (await api.get<PaginatedClients>(`/clients?page_size=10&search=${encodeURIComponent(clientSearch)}`)).data,
    enabled: open,
  });

  const { data: meetingList } = useQuery({
    queryKey: ["meetings-picker", form.client_id],
    queryFn: async () =>
      (await api.get<PaginatedMeetings>(`/meetings?page_size=50&client_id=${form.client_id}`)).data,
    enabled: open && !!form.client_id,
  });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        client_id: f.client_id,
        meeting_id: f.meeting_id || null,
        decisions: f.decisions || null,
        pending_items: f.pending_items || null,
        converted_to_procedure: f.converted_to_procedure,
      };
      if (f.id) return (await api.put(`/attendances/${f.id}`, payload)).data;
      return (await api.post("/attendances/", payload)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendances"] });
      setOpen(false);
    },
  });

  const toggleConverted = useMutation({
    mutationFn: async (a: Attendance) =>
      api.put(`/attendances/${a.id}`, { converted_to_procedure: !a.converted_to_procedure }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendances"] }),
  });

  const openNew = () => {
    setForm(emptyForm());
    setClientSearch("");
    setOpen(true);
  };
  const openEdit = (a: Attendance) => {
    setForm({
      id: a.id,
      client_id: a.client_id,
      meeting_id: a.meeting_id ?? "",
      decisions: a.decisions ?? "",
      pending_items: a.pending_items ?? "",
      converted_to_procedure: a.converted_to_procedure,
    });
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Atendimentos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data ? `${data.total} registro(s)` : "Carregando..."}
          </p>
        </div>
        <button
          onClick={openNew}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          Novo Atendimento
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {([
          ["all", "Todos"],
          ["pending", "Pendentes de virar procedimento"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              tab === k
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-primary-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!data ? (
          <div className="py-16 text-center text-gray-400 text-sm">Carregando...</div>
        ) : data.items.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">Nenhum atendimento.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Reunião</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Pendências</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Data</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Procedimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(a)}
                      className="text-primary-700 hover:text-primary-900 font-medium"
                    >
                      {a.client_name ?? "—"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.meeting_subject ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{a.pending_items ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{formatDate(a.created_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleConverted.mutate(a)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        a.converted_to_procedure
                          ? "bg-green-50 text-green-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {a.converted_to_procedure ? <Check size={12} /> : null}
                      {a.converted_to_procedure ? "Convertido" : "Pendente"}
                    </button>
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
              <h2 className="text-lg font-bold">{form.id ? "Editar" : "Novo"} Atendimento</h2>
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
                  onChange={(e) => setForm({ ...form, client_id: e.target.value, meeting_id: "" })}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reunião relacionada (opcional)
                </label>
                <select
                  value={form.meeting_id}
                  onChange={(e) => setForm({ ...form, meeting_id: e.target.value })}
                  disabled={!form.client_id}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100"
                >
                  <option value="">— nenhuma —</option>
                  {meetingList?.items.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.subject} ({formatDate(m.scheduled_at)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Decisões</label>
                <textarea
                  rows={3}
                  value={form.decisions}
                  onChange={(e) => setForm({ ...form, decisions: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pendências</label>
                <textarea
                  rows={3}
                  value={form.pending_items}
                  onChange={(e) => setForm({ ...form, pending_items: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.converted_to_procedure}
                  onChange={(e) => setForm({ ...form, converted_to_procedure: e.target.checked })}
                />
                Já convertido em procedimento
              </label>

              {save.isError && (
                <p className="text-red-600 text-sm">Erro ao salvar. Selecione um cliente.</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => save.mutate(form)}
                  disabled={save.isPending || !form.client_id}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm"
                >
                  {save.isPending ? "Salvando..." : "Salvar"}
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
