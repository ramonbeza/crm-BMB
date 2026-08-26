/**
 * Painel de colaboração do procedimento: comentários, tarefas, transferências e anexos.
 * Renderizado como abas dentro do ProcedureDetailPage.
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare, ListTodo, History, Paperclip,
  Send, Plus, Trash2, CheckCheck, Circle, ArrowRight, Upload, FileText,
  type LucideProps,
} from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import type {
  ProcedureComment, ProcedureTask, ProcedureTransfer, ProcedureAttachment,
  User, TaskStatus,
} from "@/types";

type Tab = "comentarios" | "tarefas" | "transferencias" | "anexos";

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

// ── Comments ──────────────────────────────────────────────────────────────────

function CommentsTab({ procedureId }: { procedureId: string }) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: comments = [] } = useQuery<ProcedureComment[]>({
    queryKey: ["procedure-comments", procedureId],
    queryFn: () => api.get(`/procedures/${procedureId}/comentarios`).then((r) => r.data),
  });

  const add = useMutation({
    mutationFn: (content: string) =>
      api.post(`/procedures/${procedureId}/comentarios`, { content }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procedure-comments", procedureId] });
      setText("");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/procedures/${procedureId}/comentarios/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procedure-comments", procedureId] }),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {comments.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Nenhuma nota interna ainda.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-700">{c.author_name ?? "—"}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                {(c.author_id === user?.id || user?.role === "admin") && (
                  <button
                    onClick={() => remove.mutate(c.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.content}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escrever nota interna..."
          rows={2}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
        <button
          onClick={() => text.trim() && add.mutate(text.trim())}
          disabled={!text.trim() || add.isPending}
          className="self-end px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

function TasksTab({ procedureId, users }: { procedureId: string; users: User[] }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assigned_to_id: "", due_date: "" });

  const { data: tasks = [] } = useQuery<ProcedureTask[]>({
    queryKey: ["procedure-tasks", procedureId],
    queryFn: () => api.get(`/procedures/${procedureId}/tarefas`).then((r) => r.data),
  });

  const add = useMutation({
    mutationFn: () =>
      api.post(`/procedures/${procedureId}/tarefas`, {
        title: form.title,
        description: form.description || null,
        assigned_to_id: form.assigned_to_id || null,
        due_date: form.due_date || null,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procedure-tasks", procedureId] });
      qc.invalidateQueries({ queryKey: ["workspace"] });
      setShowForm(false);
      setForm({ title: "", description: "", assigned_to_id: "", due_date: "" });
    },
  });

  const patch = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      api.patch(`/procedures/${procedureId}/tarefas/${id}`, { status }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procedure-tasks", procedureId] });
      qc.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/procedures/${procedureId}/tarefas/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procedure-tasks", procedureId] });
      qc.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const nextStatus = (s: TaskStatus): TaskStatus =>
    s === "pendente" ? "em_andamento" : s === "em_andamento" ? "concluida" : "pendente";

  return (
    <div className="space-y-3">
      {tasks.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 text-center py-6">Nenhuma tarefa criada.</p>
      )}

      {tasks.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 p-3 rounded-lg border ${
            t.status === "concluida" ? "bg-green-50 border-green-100" : "bg-gray-50 border-gray-100"
          }`}
        >
          <button
            onClick={() => patch.mutate({ id: t.id, status: nextStatus(t.status as TaskStatus) })}
            className="mt-0.5 shrink-0"
            title={`Avançar para: ${TASK_STATUS_LABEL[nextStatus(t.status as TaskStatus)]}`}
          >
            {t.status === "concluida" ? (
              <CheckCheck size={18} className="text-green-500" />
            ) : (
              <Circle size={18} className={t.status === "em_andamento" ? "text-primary-500" : "text-gray-300"} />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${t.status === "concluida" ? "line-through text-gray-400" : "text-gray-800"}`}>
              {t.title}
            </p>
            {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
            <div className="flex gap-3 mt-1 text-xs text-gray-400">
              {t.assigned_to_name && <span>→ {t.assigned_to_name}</span>}
              {t.due_date && <span>Prazo: {formatDate(t.due_date)}</span>}
              <span className="capitalize">{TASK_STATUS_LABEL[t.status as TaskStatus]}</span>
            </div>
          </div>
          <button onClick={() => remove.mutate(t.id)} className="text-gray-300 hover:text-red-500 shrink-0 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {showForm && (
        <div className="border border-primary-200 rounded-lg p-4 bg-primary-50 space-y-3">
          <input
            type="text"
            placeholder="Título da tarefa *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <input
            type="text"
            placeholder="Descrição (opcional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <div className="flex gap-2">
            <select
              value={form.assigned_to_id}
              onChange={(e) => setForm({ ...form, assigned_to_id: e.target.value })}
              className="flex-1 text-sm border border-gray-200 rounded px-2 py-2 focus:outline-none"
            >
              <option value="">Atribuir para (opcional)</option>
              {users.filter((u) => u.is_active && u.role !== "despachante_externo").map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="text-sm border border-gray-200 rounded px-2 py-2 focus:outline-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
              Cancelar
            </button>
            <button
              onClick={() => form.title.trim() && add.mutate()}
              disabled={!form.title.trim() || add.isPending}
              className="text-sm bg-primary-600 text-white px-4 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-40"
            >
              Criar tarefa
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 transition-colors"
        >
          <Plus size={15} /> Nova tarefa
        </button>
      )}
    </div>
  );
}

// ── Transfer history ──────────────────────────────────────────────────────────

function TransfersTab({ procedureId, users, canTransfer }: {
  procedureId: string;
  users: User[];
  canTransfer: boolean;
}) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [toUserId, setToUserId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: transfers = [] } = useQuery<ProcedureTransfer[]>({
    queryKey: ["procedure-transfers", procedureId],
    queryFn: () => api.get(`/procedures/${procedureId}/transferencias`).then((r) => r.data),
  });

  const transfer = useMutation({
    mutationFn: () =>
      api.post(`/procedures/${procedureId}/transferir`, {
        to_user_id: toUserId,
        notes: notes || null,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procedure-transfers", procedureId] });
      qc.invalidateQueries({ queryKey: ["procedure", procedureId] });
      qc.invalidateQueries({ queryKey: ["workspace"] });
      setShowForm(false);
      setToUserId("");
      setNotes("");
    },
  });

  const eligibleUsers = users.filter((u) => u.is_active && u.role !== "despachante_externo");

  return (
    <div className="space-y-4">
      {canTransfer && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 transition-colors"
        >
          <ArrowRight size={15} /> Transferir responsabilidade
        </button>
      )}

      {showForm && (
        <div className="border border-primary-200 rounded-lg p-4 bg-primary-50 space-y-3">
          <select
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none"
          >
            <option value="">Selecionar novo responsável *</option>
            {eligibleUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Observação (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-3 py-1.5">Cancelar</button>
            <button
              onClick={() => toUserId && transfer.mutate()}
              disabled={!toUserId || transfer.isPending}
              className="text-sm bg-primary-600 text-white px-4 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-40"
            >
              {transfer.isPending ? "Transferindo..." : "Confirmar"}
            </button>
          </div>
          {transfer.isError && (
            <p className="text-xs text-red-600">{(transfer.error as any)?.response?.data?.detail ?? "Erro ao transferir"}</p>
          )}
        </div>
      )}

      {transfers.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">Nenhuma transferência registrada.</p>
      )}

      <div className="space-y-2">
        {transfers.map((t) => (
          <div key={t.id} className="flex items-start gap-3 text-sm p-3 bg-gray-50 rounded-lg border border-gray-100">
            <History size={15} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-700">
                <span className="font-medium">{t.from_user_name ?? "Sem responsável"}</span>
                {" → "}
                <span className="font-medium text-primary-700">{t.to_user_name}</span>
              </p>
              {t.notes && <p className="text-gray-500 text-xs mt-0.5 italic">"{t.notes}"</p>}
              <p className="text-xs text-gray-400 mt-0.5">
                por {t.transferred_by_name ?? "—"} · {formatDate(t.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Attachments ───────────────────────────────────────────────────────────────

function AttachmentsTab({ procedureId }: { procedureId: string }) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [] } = useQuery<ProcedureAttachment[]>({
    queryKey: ["procedure-attachments", procedureId],
    queryFn: () => api.get(`/procedures/${procedureId}/anexos`).then((r) => r.data),
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/procedures/${procedureId}/anexos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      qc.invalidateQueries({ queryKey: ["procedure-attachments", procedureId] });
    } finally {
      setUploading(false);
    }
  };

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/procedures/${procedureId}/anexos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procedure-attachments", procedureId] }),
  });

  const fmt = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 disabled:opacity-40 transition-colors"
      >
        <Upload size={15} /> {uploading ? "Enviando..." : "Enviar arquivo"}
      </button>

      {attachments.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">Nenhum arquivo anexado.</p>
      )}

      <div className="space-y-2">
        {attachments.map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <FileText size={16} className="text-gray-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{a.filename}</p>
              <p className="text-xs text-gray-400">
                {a.uploaded_by_name ?? "—"} · {formatDate(a.created_at)}
                {a.file_size ? ` · ${fmt(a.file_size)}` : ""}
              </p>
            </div>
            {(a.uploaded_by_id === user?.id || user?.role === "admin") && (
              <button
                onClick={() => remove.mutate(a.id)}
                className="text-gray-300 hover:text-red-500 shrink-0 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  procedureId: string;
  users: User[];
  canTransfer: boolean;
}

export function ProcedureCollabPanel({ procedureId, users, canTransfer }: Props) {
  const [tab, setTab] = useState<Tab>("comentarios");

  type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "comentarios", label: "Notas", icon: MessageSquare },
    { id: "tarefas", label: "Tarefas", icon: ListTodo },
    { id: "transferencias", label: "Transferências", icon: History },
    { id: "anexos", label: "Anexos", icon: Paperclip },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex gap-1 border-b border-gray-100 mb-4 -mx-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-t transition-colors ${
              tab === id
                ? "text-primary-700 border-b-2 border-primary-600 font-medium -mb-px"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={14} className="" />
            {label}
          </button>
        ))}
      </div>

      {tab === "comentarios" && <CommentsTab procedureId={procedureId} />}
      {tab === "tarefas" && <TasksTab procedureId={procedureId} users={users} />}
      {tab === "transferencias" && (
        <TransfersTab procedureId={procedureId} users={users} canTransfer={canTransfer} />
      )}
      {tab === "anexos" && <AttachmentsTab procedureId={procedureId} />}
    </div>
  );
}
