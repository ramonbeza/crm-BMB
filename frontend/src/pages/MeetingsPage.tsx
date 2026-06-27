import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { EventClickArg } from "@fullcalendar/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Calendar, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Meeting, PaginatedMeetings, PaginatedClients, ReceptionType, MeetingStatus } from "@/types";

interface FormState {
  id?: string;
  client_id: string;
  scheduled_at: string;
  reception_type: ReceptionType;
  subject: string;
  summary: string;
  status: MeetingStatus;
  google_event_id?: string | null;
}

const emptyForm = (date?: string): FormState => ({
  client_id: "",
  scheduled_at: date ? `${date}T09:00` : "",
  reception_type: "presencial",
  subject: "",
  summary: "",
  status: "agendada",
  google_event_id: null,
});

const statusColor: Record<MeetingStatus, string> = {
  agendada: "#2563eb",
  realizada: "#16a34a",
  cancelada: "#9ca3af",
};

export function MeetingsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [clientSearch, setClientSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: meetings } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => (await api.get<PaginatedMeetings>("/meetings?page_size=200")).data,
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
        scheduled_at: new Date(f.scheduled_at).toISOString(),
        reception_type: f.reception_type,
        subject: f.subject,
        summary: f.summary || null,
        status: f.status,
      };
      if (f.id) return (await api.put(`/meetings/${f.id}`, payload)).data;
      return (await api.post("/meetings", payload)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      setSaveError(null);
      setOpen(false);
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setSaveError(detail ?? "Erro ao salvar. Verifique os campos obrigatórios.");
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/meetings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      setConfirmDelete(false);
      setOpen(false);
    },
  });

  const [syncMsg, setSyncMsg] = useState("");
  const syncGoogle = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/integrations/google/sync-meeting/${id}`);
      return data;
    },
    onSuccess: (data) => {
      setSyncMsg(`Sincronizado! Ver no Google Calendar: ${data.html_link ?? data.google_event_id}`);
      // Atualiza o form para refletir que foi sincronizado (botão fica verde)
      if (data.google_event_id) {
        setForm((f) => ({ ...f, google_event_id: data.google_event_id }));
      }
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        setSyncMsg("Sem autorização para acessar o Google Calendar. Reconecte em Configurações > Integrações.");
      } else if (status === 404) {
        setSyncMsg("Reunião não encontrada. Recarregue a página e tente novamente.");
      } else if (status === 503 || status === 502) {
        setSyncMsg("Google Calendar indisponível no momento. Tente novamente em alguns instantes.");
      } else if (!status) {
        setSyncMsg("Sem conexão com o servidor. Verifique sua internet e tente novamente.");
      } else {
        setSyncMsg("Erro ao sincronizar com o Google Calendar. Verifique a integração em Configurações > Integrações.");
      }
    },
  });

  const events = useMemo(
    () =>
      (meetings?.items ?? []).map((m: Meeting) => ({
        id: m.id,
        title: `${m.subject}${m.client_name ? " — " + m.client_name : ""}`,
        start: m.scheduled_at,
        backgroundColor: statusColor[m.status],
        borderColor: statusColor[m.status],
        extendedProps: { meeting: m },
      })),
    [meetings]
  );

  const openNew = (date?: string) => {
    setForm(emptyForm(date));
    setClientSearch("");
    setSaveError(null);
    setOpen(true);
  };

  const openEdit = (m: Meeting) => {
    setSaveError(null);
    setConfirmDelete(false);
    setForm({
      id: m.id,
      client_id: m.client_id,
      scheduled_at: m.scheduled_at.slice(0, 16),
      reception_type: m.reception_type,
      subject: m.subject,
      summary: m.summary ?? "",
      status: m.status,
      google_event_id: m.google_event_id ?? null,
    });
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {meetings ? `${meetings.total} reunião(ões)` : "Carregando..."}
          </p>
        </div>
        <button
          onClick={() => openNew()}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          Nova Reunião
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale="pt-br"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          buttonText={{ today: "Hoje", month: "Mês", week: "Semana", day: "Dia" }}
          events={events}
          height="auto"
          dateClick={(arg: DateClickArg) => openNew(arg.dateStr.slice(0, 10))}
          eventClick={(arg: EventClickArg) => openEdit(arg.event.extendedProps.meeting as Meeting)}
        />
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{form.id ? "Editar Reunião" : "Nova Reunião"}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <input
                  placeholder="Buscar cliente por nome/CPF/CNPJ..."
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Assunto *</label>
                <input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data e hora *</label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma de recepção</label>
                  <select
                    value={form.reception_type}
                    onChange={(e) => setForm({ ...form, reception_type: e.target.value as ReceptionType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="presencial">Presencial</option>
                    <option value="email">E-mail</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as MeetingStatus })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="agendada">Agendada</option>
                  <option value="realizada">Realizada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resumo</label>
                <textarea
                  rows={3}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {saveError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => save.mutate(form)}
                  disabled={save.isPending || !form.client_id || !form.subject || !form.scheduled_at}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm"
                >
                  {save.isPending ? "Salvando..." : "Salvar"}
                </button>
                {form.id && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="px-5 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
                  >
                    Excluir
                  </button>
                )}
                {form.id && (
                  <button
                    onClick={() => { setSyncMsg(""); syncGoogle.mutate(form.id!); }}
                    disabled={syncGoogle.isPending}
                    title={form.google_event_id ? "Atualizar evento no Google Calendar" : "Criar evento no Google Calendar"}
                    className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm disabled:opacity-50 ${
                      form.google_event_id
                        ? "border-green-300 text-green-700 bg-green-50 hover:bg-green-100"
                        : "border-blue-200 text-blue-600 hover:bg-blue-50"
                    }`}
                  >
                    {syncGoogle.isPending ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
                    {form.google_event_id ? "Sincronizado ✓" : "Sincronizar"}
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
              {syncMsg && (
                <p className={`text-xs mt-2 ${syncMsg.startsWith("Erro") || syncMsg.startsWith("Sem") ? "text-red-600" : "text-green-600"}`}>
                  {syncMsg}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete meeting */}
      {confirmDelete && form.id && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <p className="text-base font-semibold text-gray-900 mb-2">Excluir reunião?</p>
            <p className="text-sm text-gray-500 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => del.mutate(form.id!)}
                disabled={del.isPending}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                {del.isPending ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
