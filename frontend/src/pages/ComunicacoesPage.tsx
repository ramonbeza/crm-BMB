import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Mail,
  Phone,
  Plus,
  X,
  AlertCircle,
  FileText,
  Send,
} from "lucide-react";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TemplateRead {
  id: string;
  name: string;
  channel: string;
  channel_label: string;
  subject: string | null;
  body: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
}

interface CommListItem {
  id: string;
  channel: string;
  channel_label: string;
  status: string;
  status_label: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  subject: string | null;
  sent_at: string | null;
  created_at: string;
}

interface PaginatedComms {
  items: CommListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const statusCls: Record<string, string> = {
  pendente: "bg-amber-50 text-amber-700 border-amber-200",
  enviado: "bg-blue-50 text-blue-700 border-blue-200",
  entregue: "bg-green-50 text-green-700 border-green-200",
  lido: "bg-green-100 text-green-800 border-green-300",
  falhou: "bg-red-50 text-red-600 border-red-200",
};

const channelIcon: Record<string, React.ElementType> = {
  whatsapp: Phone,
  email: Mail,
  interno: MessageSquare,
};

// ── Send modal ────────────────────────────────────────────────────────────────

type Tab = "historico" | "templates" | "novo";

interface SendForm {
  channel: "whatsapp" | "email";
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string;
  subject: string;
  body: string;
  template_id: string;
}

const EMPTY_FORM: SendForm = {
  channel: "whatsapp",
  recipient_name: "",
  recipient_phone: "",
  recipient_email: "",
  subject: "",
  body: "",
  template_id: "",
};

function SendModal({
  templates,
  onClose,
  onSent,
}: {
  templates: TemplateRead[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [form, setForm] = useState<SendForm>(EMPTY_FORM);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const set = (k: keyof SendForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // When template is chosen, load it and pre-fill body/subject
  const selectedTemplate = templates.find((t) => t.id === form.template_id) ?? null;

  const handleTemplateChange = (id: string) => {
    const tmpl = templates.find((t) => t.id === id);
    if (tmpl) {
      set("template_id", id);
      set("channel", tmpl.channel as "whatsapp" | "email");
      set("body", tmpl.body);
      set("subject", tmpl.subject ?? "");
      setVars({});
      setPreviewBody(null);
    } else {
      set("template_id", "");
    }
  };

  const handleVarChange = (k: string, v: string) => {
    const newVars = { ...vars, [k]: v };
    setVars(newVars);
    if (selectedTemplate) {
      let rendered = selectedTemplate.body;
      for (const [key, val] of Object.entries(newVars)) {
        rendered = rendered.split(`{{${key}}}`).join(val);
      }
      setPreviewBody(rendered);
      set("body", rendered);
    }
  };

  const mutation = useMutation({
    mutationFn: async () =>
      api.post("/communications/", {
        channel: form.channel,
        recipient_name: form.recipient_name || null,
        recipient_phone: form.recipient_phone || null,
        recipient_email: form.recipient_email || null,
        subject: form.subject || null,
        body: form.body,
        template_id: form.template_id || null,
      }),
    onSuccess: () => {
      onSent();
      onClose();
    },
    onError: () => setError("Erro ao enviar a mensagem."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Send size={16} />
            Enviar mensagem
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Template selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Template (opcional)</label>
            <select
              value={form.template_id}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">— Sem template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.channel_label}] {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Template variables */}
          {selectedTemplate && selectedTemplate.variables.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500">Variáveis do template</p>
              {selectedTemplate.variables.map((v) => (
                <div key={v}>
                  <label className="block text-xs text-gray-500 mb-0.5">
                    {"{{" + v + "}}"}
                  </label>
                  <input
                    type="text"
                    value={vars[v] ?? ""}
                    onChange={(e) => handleVarChange(v, e.target.value)}
                    placeholder={v}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Channel */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Canal *</label>
            <div className="flex gap-2">
              {(["whatsapp", "email"] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => set("channel", ch)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                    form.channel === ch
                      ? "bg-primary-600 text-white border-primary-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {ch === "whatsapp" ? <Phone size={14} /> : <Mail size={14} />}
                  {ch === "whatsapp" ? "WhatsApp" : "E-mail"}
                </button>
              ))}
            </div>
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome do destinatário</label>
            <input
              type="text"
              value={form.recipient_name}
              onChange={(e) => set("recipient_name", e.target.value)}
              placeholder="João Silva"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {form.channel === "whatsapp" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Número (com DDI) *</label>
              <input
                type="text"
                value={form.recipient_phone}
                onChange={(e) => set("recipient_phone", e.target.value)}
                placeholder="5511999999999"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          )}

          {form.channel === "email" && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">E-mail do destinatário *</label>
                <input
                  type="email"
                  value={form.recipient_email}
                  onChange={(e) => set("recipient_email", e.target.value)}
                  placeholder="cliente@exemplo.com"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Assunto</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => set("subject", e.target.value)}
                  placeholder="Assunto do e-mail"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
            </>
          )}

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Mensagem *
              {previewBody && (
                <span className="ml-2 text-primary-500 font-normal">(pré-visualização com variáveis)</span>
              )}
            </label>
            <textarea
              rows={6}
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              placeholder="Digite sua mensagem ou selecione um template..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              !form.body ||
              (form.channel === "whatsapp" && !form.recipient_phone) ||
              (form.channel === "email" && !form.recipient_email)
            }
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
          >
            <Send size={14} />
            {mutation.isPending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Template form ─────────────────────────────────────────────────────────────

function TemplateForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [varInput, setVarInput] = useState("");
  const [variables, setVariables] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: async () =>
      api.post("/communications/templates/", { name, channel, subject: subject || null, body, variables }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const addVar = () => {
    const v = varInput.trim().replace(/\s+/g, "_");
    if (v && !variables.includes(v)) {
      setVariables((vs) => [...vs, v]);
    }
    setVarInput("");
  };

  const insertVar = (v: string) => {
    setBody((b) => b + `{{${v}}}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-base font-bold text-gray-900">Novo template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Solicitação de documentos"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Canal *</label>
            <div className="flex gap-2">
              {["whatsapp", "email"].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannel(ch)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                    channel === ch
                      ? "bg-primary-600 text-white border-primary-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {ch === "whatsapp" ? <Phone size={14} /> : <Mail size={14} />}
                  {ch === "whatsapp" ? "WhatsApp" : "E-mail"}
                </button>
              ))}
            </div>
          </div>

          {channel === "email" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assunto padrão</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Assunto do e-mail"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          )}

          {/* Variables */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Variáveis dinâmicas</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={varInput}
                onChange={(e) => setVarInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addVar()}
                placeholder="nome_cliente"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <button
                onClick={addVar}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg"
              >
                Adicionar
              </button>
            </div>
            {variables.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {variables.map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVar(v)}
                    title="Clique para inserir no corpo"
                    className="px-2 py-0.5 bg-primary-50 text-primary-700 border border-primary-200 rounded text-xs font-mono hover:bg-primary-100"
                  >
                    {"{{" + v + "}}"}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">Clique numa variável para inseri-la no corpo</p>
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Corpo *</label>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Olá {{nome_cliente}},&#10;&#10;Segue a atualização do seu processo {{numero_processo}}..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name || !body}
            className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
          >
            {mutation.isPending ? "Salvando..." : "Salvar template"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ComunicacoesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("historico");
  const [page, setPage] = useState(1);
  const [filterChannel, setFilterChannel] = useState("");
  const [showSend, setShowSend] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);

  const { data: templates = [] } = useQuery<TemplateRead[]>({
    queryKey: ["templates"],
    queryFn: async () => (await api.get<TemplateRead[]>("/communications/templates/")).data,
  });

  const { data: history, isLoading } = useQuery<PaginatedComms>({
    queryKey: ["comms", page, filterChannel],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, page_size: 20 };
      if (filterChannel) params.channel = filterChannel;
      return (await api.get<PaginatedComms>("/communications/", { params })).data;
    },
    enabled: tab === "historico",
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => api.delete(`/communications/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Comunicações</h1>
          <p className="text-sm text-gray-500 mt-0.5">Histórico de mensagens e templates</p>
        </div>
        <button
          onClick={() => setShowSend(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg"
        >
          <Send size={16} />
          Enviar mensagem
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["historico", "templates"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "historico" ? "Histórico" : "Templates"}
          </button>
        ))}
      </div>

      {/* ── Histórico ── */}
      {tab === "historico" && (
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="px-5 py-3 border-b border-gray-100 flex gap-3 items-center">
            <select
              value={filterChannel}
              onChange={(e) => { setFilterChannel(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">Todos os canais</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-mail</option>
            </select>
            {history && (
              <span className="ml-auto text-xs text-gray-400">{history.total} mensagens</span>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-gray-400 text-sm">Carregando...</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {history?.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <MessageSquare size={28} className="mb-3 opacity-40" />
                  <p className="text-sm">Nenhuma mensagem enviada ainda.</p>
                </div>
              ) : (
                history?.items.map((c) => {
                  const Icon = channelIcon[c.channel] ?? MessageSquare;
                  return (
                    <div key={c.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        c.channel === "whatsapp" ? "bg-green-50 text-green-600" :
                        c.channel === "email" ? "bg-blue-50 text-blue-600" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">
                            {c.recipient_name ?? c.recipient_phone ?? c.recipient_email ?? "—"}
                          </span>
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${statusCls[c.status] ?? ""}`}>
                            {c.status_label}
                          </span>
                        </div>
                        {c.subject && (
                          <p className="text-xs font-medium text-gray-600 mt-0.5">{c.subject}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {c.channel_label} ·{" "}
                          {c.sent_at
                            ? new Date(c.sent_at).toLocaleString("pt-BR")
                            : new Date(c.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {history && history.pages > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-xs text-gray-400">Página {page} de {history.pages}</span>
              <button
                onClick={() => setPage((p) => Math.min(history.pages, p + 1))}
                disabled={page === history.pages}
                className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
              >
                Próxima →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Templates ── */}
      {tab === "templates" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewTemplate(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Plus size={14} />
              Novo template
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-12 text-gray-400">
              <FileText size={28} className="mb-3 opacity-40" />
              <p className="text-sm">Nenhum template criado.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {templates.map((t) => {
                const Icon = channelIcon[t.channel] ?? MessageSquare;
                return (
                  <div key={t.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 group">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${
                      t.channel === "whatsapp" ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"
                    }`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{t.name}</span>
                        <span className="text-xs text-gray-400">{t.channel_label}</span>
                        {!t.is_active && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Inativo</span>
                        )}
                      </div>
                      {t.subject && (
                        <p className="text-xs text-gray-500 mt-0.5">Assunto: {t.subject}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 font-mono">{t.body}</p>
                      {t.variables.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {t.variables.map((v) => (
                            <span key={v} className="text-xs font-mono bg-primary-50 text-primary-600 px-1.5 py-0.5 rounded">
                              {"{{" + v + "}}"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteTemplate.mutate(t.id)}
                      disabled={deleteTemplate.isPending}
                      className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 flex-shrink-0 transition-opacity"
                    >
                      Desativar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showSend && (
        <SendModal
          templates={templates}
          onClose={() => setShowSend(false)}
          onSent={() => {
            qc.invalidateQueries({ queryKey: ["comms"] });
          }}
        />
      )}
      {showNewTemplate && (
        <TemplateForm
          onClose={() => setShowNewTemplate(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["templates"] })}
        />
      )}
    </div>
  );
}
