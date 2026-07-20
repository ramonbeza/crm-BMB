import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import rrulePlugin from "@fullcalendar/rrule";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { EventClickArg } from "@fullcalendar/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Calendar, Loader2, RepeatIcon } from "lucide-react";
import { api } from "@/lib/api";
import type {
  Meeting,
  MeetingCategory,
  MeetingStatus,
  PaginatedClients,
  PaginatedMeetings,
  RecurrenceType,
  ReceptionType,
} from "@/types";

// ── category config ────────────────────────────────────────────────────────────

interface CategoryConfig {
  label: string;
  color: string;
  needsClient: boolean;
}

const CATEGORIES: Record<MeetingCategory, CategoryConfig> = {
  reuniao_cliente:  { label: "Reunião com Cliente",      color: "#2563eb", needsClient: true  },
  audiencia:        { label: "Audiência / Sessão",        color: "#7c3aed", needsClient: false },
  cartorio:         { label: "Diligência em Cartório",    color: "#0891b2", needsClient: false },
  prefeitura:       { label: "Diligência na Prefeitura",  color: "#0d9488", needsClient: false },
  reuniao_interna:  { label: "Reunião Interna",           color: "#4f46e5", needsClient: false },
  visita_imovel:    { label: "Visita ao Imóvel",          color: "#ea580c", needsClient: true  },
  prazo:            { label: "Prazo / Vencimento",        color: "#dc2626", needsClient: false },
  outro:            { label: "Outro",                     color: "#6b7280", needsClient: false },
};

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none:      "Sem repetição",
  daily:     "Diário",
  weekly:    "Semanal",
  biweekly:  "Quinzenal (a cada 2 semanas)",
  monthly:   "Mensal",
  yearly:    "Anual",
};

const WEEKDAYS = [
  { value: "0", label: "Seg" },
  { value: "1", label: "Ter" },
  { value: "2", label: "Qua" },
  { value: "3", label: "Qui" },
  { value: "4", label: "Sex" },
  { value: "5", label: "Sáb" },
  { value: "6", label: "Dom" },
];

// FullCalendar rrule weekday names (by index)
const FC_WEEKDAYS = ["mo", "tu", "we", "th", "fr", "sa", "su"];

// Convert meeting recurrence to FullCalendar rrule object
function toFcRrule(m: Meeting) {
  if (m.recurrence_type === "none") return null;

  const dtstart = m.scheduled_at; // ISO string

  const base: Record<string, unknown> = { dtstart };
  if (m.recurrence_end_date) base.until = m.recurrence_end_date;

  const days = m.recurrence_days
    ? m.recurrence_days.split(",").map((d) => FC_WEEKDAYS[parseInt(d)]).filter(Boolean)
    : [];

  switch (m.recurrence_type) {
    case "daily":
      return { ...base, freq: "daily" };
    case "weekly":
      return { ...base, freq: "weekly", ...(days.length ? { byweekday: days } : {}) };
    case "biweekly":
      return { ...base, freq: "weekly", interval: 2, ...(days.length ? { byweekday: days } : {}) };
    case "monthly":
      return { ...base, freq: "monthly" };
    case "yearly":
      return { ...base, freq: "yearly" };
    default:
      return null;
  }
}

// ── form state ─────────────────────────────────────────────────────────────────

interface FormState {
  id?: string;
  meeting_category: MeetingCategory;
  client_id: string;
  scheduled_at: string;
  duration_minutes: number;
  reception_type: ReceptionType;
  subject: string;
  summary: string;
  status: MeetingStatus;
  recurrence_type: RecurrenceType;
  recurrence_days: string; // "0,1,2" comma-separated
  recurrence_end_date: string;
  google_event_id?: string | null;
}

const emptyForm = (date?: string): FormState => ({
  meeting_category: "reuniao_cliente",
  client_id: "",
  scheduled_at: date ? `${date}T09:00` : "",
  duration_minutes: 60,
  reception_type: "presencial",
  subject: "",
  summary: "",
  status: "agendada",
  recurrence_type: "none",
  recurrence_days: "",
  recurrence_end_date: "",
  google_event_id: null,
});

// ── helpers ───────────────────────────────────────────────────────────────────

function durationStr(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── MeetingsPage ───────────────────────────────────────────────────────────────

export function MeetingsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [clientSearch, setClientSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState("");

  const { data: meetings } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => (await api.get<PaginatedMeetings>("/meetings?page_size=500")).data,
  });

  const catCfg = CATEGORIES[form.meeting_category];

  const { data: clients } = useQuery({
    queryKey: ["clients-picker", clientSearch],
    queryFn: async () =>
      (await api.get<PaginatedClients>(`/clients?page_size=10&search=${encodeURIComponent(clientSearch)}`)).data,
    enabled: open && catCfg.needsClient,
  });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        meeting_category: f.meeting_category,
        client_id: catCfg.needsClient && f.client_id ? f.client_id : null,
        scheduled_at: new Date(f.scheduled_at).toISOString(),
        duration_minutes: f.duration_minutes,
        reception_type: f.reception_type,
        subject: f.subject,
        summary: f.summary || null,
        status: f.status,
        recurrence_type: f.recurrence_type,
        recurrence_days: (f.recurrence_type === "weekly" || f.recurrence_type === "biweekly") && f.recurrence_days
          ? f.recurrence_days : null,
        recurrence_end_date: f.recurrence_end_date || null,
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

  const syncGoogle = useMutation({
    mutationFn: async (id: string) => (await api.post(`/integrations/google/sync-meeting/${id}`)).data,
    onSuccess: (data) => {
      setSyncMsg(`Sincronizado! ${data.html_link ?? data.google_event_id}`);
      if (data.google_event_id) setForm((f) => ({ ...f, google_event_id: data.google_event_id }));
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setSyncMsg(
        status === 401 || status === 403
          ? "Sem autorização. Reconecte em Integrações."
          : "Erro ao sincronizar com o Google Calendar.",
      );
    },
  });

  // Build FullCalendar events — recurring meetings use rrule, one-off use start
  const events = useMemo(() => {
    return (meetings?.items ?? []).map((m: Meeting) => {
      const cfg = CATEGORIES[m.meeting_category] ?? CATEGORIES.outro;
      const title = m.client_name
        ? `${m.subject} — ${m.client_name}`
        : m.meeting_category_label
        ? `[${m.meeting_category_label}] ${m.subject}`
        : m.subject;
      const duration = durationStr(m.duration_minutes ?? 60);
      const rrule = toFcRrule(m);

      return rrule
        ? {
            id: m.id,
            title,
            rrule,
            duration,
            backgroundColor: cfg.color,
            borderColor: cfg.color,
            extendedProps: { meeting: m },
          }
        : {
            id: m.id,
            title,
            start: m.scheduled_at,
            end: new Date(
              new Date(m.scheduled_at).getTime() + (m.duration_minutes ?? 60) * 60_000,
            ).toISOString(),
            backgroundColor: cfg.color,
            borderColor: cfg.color,
            extendedProps: { meeting: m },
          };
    });
  }, [meetings]);

  const openNew = (date?: string) => {
    setForm(emptyForm(date));
    setClientSearch("");
    setSaveError(null);
    setSyncMsg("");
    setOpen(true);
  };

  const openEdit = (m: Meeting) => {
    setSaveError(null);
    setSyncMsg("");
    setConfirmDelete(false);
    setForm({
      id: m.id,
      meeting_category: m.meeting_category,
      client_id: m.client_id ?? "",
      scheduled_at: m.scheduled_at.slice(0, 16),
      duration_minutes: m.duration_minutes ?? 60,
      reception_type: m.reception_type,
      subject: m.subject,
      summary: m.summary ?? "",
      status: m.status,
      recurrence_type: m.recurrence_type ?? "none",
      recurrence_days: m.recurrence_days ?? "",
      recurrence_end_date: m.recurrence_end_date ?? "",
      google_event_id: m.google_event_id ?? null,
    });
    setOpen(true);
  };

  const isValid = Boolean(
    form.subject &&
    form.scheduled_at &&
    (!catCfg.needsClient || form.client_id),
  );

  // Weekday toggle for weekly/biweekly
  const selectedDays = new Set(form.recurrence_days ? form.recurrence_days.split(",") : []);
  const toggleDay = (val: string) => {
    const next = new Set(selectedDays);
    next.has(val) ? next.delete(val) : next.add(val);
    setForm({ ...form, recurrence_days: [...next].sort().join(",") });
  };

  const showWeekdays = form.recurrence_type === "weekly" || form.recurrence_type === "biweekly";

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {meetings ? `${meetings.total} compromisso(s)` : "Carregando..."}
          </p>
        </div>
        <button
          onClick={() => openNew()}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          Novo Compromisso
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {(Object.entries(CATEGORIES) as [MeetingCategory, CategoryConfig][]).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
            {cfg.label}
          </span>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}
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

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{form.id ? "Editar Compromisso" : "Novo Compromisso"}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Tipo de compromisso */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de compromisso *</label>
                <select
                  value={form.meeting_category}
                  onChange={(e) => {
                    setForm({ ...form, meeting_category: e.target.value as MeetingCategory, client_id: "" });
                    setClientSearch("");
                  }}
                  className={inputCls}
                >
                  {(Object.entries(CATEGORIES) as [MeetingCategory, CategoryConfig][]).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: catCfg.color }} />
                  <span className="text-xs text-gray-400">cor no calendário</span>
                </div>
              </div>

              {/* Assunto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assunto *</label>
                <input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Ex: Assinatura da escritura, Audiência de instrução..."
                  className={inputCls}
                />
              </div>

              {/* Cliente (condicional) */}
              {catCfg.needsClient && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                  <input
                    placeholder="Buscar por nome, CPF ou CNPJ..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className={`${inputCls} mb-2`}
                  />
                  <select
                    value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                    className={`${inputCls} bg-white`}
                  >
                    <option value="">— selecione —</option>
                    {clients?.items.map((c) => (
                      <option key={c.id} value={c.id}>{c.display_name} ({c.document})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Data/hora + Duração */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data e hora *</label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duração</label>
                  <select
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                    className={`${inputCls} bg-white`}
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 hora</option>
                    <option value={90}>1h 30min</option>
                    <option value={120}>2 horas</option>
                    <option value={180}>3 horas</option>
                    <option value={240}>4 horas</option>
                    <option value={480}>Dia inteiro (8h)</option>
                  </select>
                </div>
              </div>

              {/* Canal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Canal</label>
                <select
                  value={form.reception_type}
                  onChange={(e) => setForm({ ...form, reception_type: e.target.value as ReceptionType })}
                  className={`${inputCls} bg-white`}
                >
                  <option value="presencial">Presencial</option>
                  <option value="videochamada">Videochamada</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                </select>
              </div>

              {/* ── RECORRÊNCIA ──────────────────────────────────────────── */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
                <div className="flex items-center gap-2">
                  <RepeatIcon size={15} className="text-gray-500" />
                  <span className="text-sm font-semibold text-gray-700">Recorrência</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Repetir</label>
                  <select
                    value={form.recurrence_type}
                    onChange={(e) => setForm({
                      ...form,
                      recurrence_type: e.target.value as RecurrenceType,
                      recurrence_days: "",
                    })}
                    className={`${inputCls} bg-white`}
                  >
                    {(Object.entries(RECURRENCE_LABELS) as [RecurrenceType, string][]).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Dias da semana — apenas para semanal/quinzenal */}
                {showWeekdays && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Dias da semana</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {WEEKDAYS.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => toggleDay(d.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            selectedDays.has(d.value)
                              ? "bg-primary-600 text-white border-primary-600"
                              : "bg-white text-gray-600 border-gray-300 hover:border-primary-400"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Data de término */}
                {form.recurrence_type !== "none" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Repetir até (opcional — deixe em branco para sem data final)
                    </label>
                    <input
                      type="date"
                      value={form.recurrence_end_date}
                      onChange={(e) => setForm({ ...form, recurrence_end_date: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                )}

                {form.recurrence_type !== "none" && (
                  <p className="text-xs text-primary-600 bg-primary-50 rounded-lg px-3 py-2">
                    {form.recurrence_type === "daily" && "Este compromisso se repete todo dia."}
                    {form.recurrence_type === "weekly" && `Repete toda semana${selectedDays.size > 0 ? " nos dias selecionados" : ""}.`}
                    {form.recurrence_type === "biweekly" && `Repete a cada 2 semanas${selectedDays.size > 0 ? " nos dias selecionados" : ""}.`}
                    {form.recurrence_type === "monthly" && "Repete todo mês na mesma data."}
                    {form.recurrence_type === "yearly" && "Repete todo ano na mesma data."}
                    {form.recurrence_end_date && ` Até ${new Date(form.recurrence_end_date + "T00:00:00").toLocaleDateString("pt-BR")}.`}
                  </p>
                )}
              </div>
              {/* ─────────────────────────────────────────────────────────── */}

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as MeetingStatus })}
                  className={`${inputCls} bg-white`}
                >
                  <option value="agendada">Agendado</option>
                  <option value="realizada">Realizado</option>
                  <option value="cancelada">Cancelado</option>
                </select>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  rows={3}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="Local, pauta, instruções..."
                  className={inputCls}
                />
              </div>

              {saveError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
              )}

              <div className="flex gap-3 pt-2 flex-wrap">
                <button
                  onClick={() => save.mutate(form)}
                  disabled={save.isPending || !isValid}
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
                    className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm disabled:opacity-50 ${
                      form.google_event_id
                        ? "border-green-300 text-green-700 bg-green-50 hover:bg-green-100"
                        : "border-blue-200 text-blue-600 hover:bg-blue-50"
                    }`}
                  >
                    {syncGoogle.isPending ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
                    {form.google_event_id ? "Sincronizado ✓" : "Google Calendar"}
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
                <p className={`text-xs mt-1 ${syncMsg.startsWith("Erro") || syncMsg.startsWith("Sem") ? "text-red-600" : "text-green-600"}`}>
                  {syncMsg}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && form.id && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <p className="text-base font-semibold text-gray-900 mb-2">Excluir compromisso?</p>
            {form.recurrence_type !== "none" && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">
                Este é um evento recorrente. Excluir removerá todas as ocorrências.
              </p>
            )}
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
