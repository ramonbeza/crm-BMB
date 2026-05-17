export type UserRole = "admin" | "advogado" | "estagiario";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type ClientType = "PF" | "PJ";

export interface ClientPFData {
  name: string;
  cpf: string;
  birth_date?: string | null;
  civil_status?: string | null;
  rg?: string | null;
  cnh?: string | null;
  address?: string | null;
}

export interface ClientPJData {
  company_name: string;
  cnpj: string;
  address?: string | null;
}

export interface ClientPF {
  id: string;
  client_type: "PF";
  phone: string;
  email?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  pf_data: ClientPFData | null;
}

export interface ClientPJ {
  id: string;
  client_type: "PJ";
  phone: string;
  email?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  pj_data: ClientPJData | null;
}

export type ClientDetail = ClientPF | ClientPJ;

export interface ClientListItem {
  id: string;
  client_type: ClientType;
  phone: string;
  email?: string | null;
  is_active: boolean;
  created_at: string;
  display_name: string;
  document: string;
}

export interface PaginatedClients {
  items: ClientListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ── Sprint 2: Agenda & Atendimentos ──────────────────────────────────────────

export type ReceptionType = "presencial" | "email" | "whatsapp";
export type MeetingStatus = "agendada" | "realizada" | "cancelada";

export interface Meeting {
  id: string;
  client_id: string;
  user_id: string | null;
  scheduled_at: string;
  reception_type: ReceptionType;
  subject: string;
  summary: string | null;
  status: MeetingStatus;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  user_name: string | null;
}

export interface PaginatedMeetings {
  items: Meeting[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Attendance {
  id: string;
  meeting_id: string | null;
  client_id: string;
  user_id: string | null;
  decisions: string | null;
  pending_items: string | null;
  converted_to_procedure: boolean;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  user_name: string | null;
  meeting_subject: string | null;
}

export interface PaginatedAttendances {
  items: Attendance[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ── Sprint 3: Procedimentos + Etapas + Protocolo ─────────────────────────────

export type ProcedureStatus = "em_andamento" | "concluido" | "cancelado";
export type StageStatus = "pendente" | "em_andamento" | "concluida";

export interface ProcedureTypeOption {
  value: string;
  label: string;
}

export interface Stage {
  id: string;
  procedure_id: string;
  order: number;
  name: string;
  status: StageStatus;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
}

export interface Procedure {
  id: string;
  protocol_number: number;
  client_id: string;
  procedure_type: string;
  procedure_type_label: string | null;
  opened_at: string;
  description: string | null;
  property_description: string | null;
  matricula: string | null;
  incra: string | null;
  inscricao_imobiliaria: string | null;
  requerente: string | null;
  deadline: string | null;
  tags: string[];
  status: ProcedureStatus;
  responsible_user_id: string | null;
  responsible_name: string | null;
  attendance_id: string | null;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  stages: Stage[];
}

export interface ProcedureListItem {
  id: string;
  protocol_number: number;
  client_name: string | null;
  procedure_type: string;
  procedure_type_label: string;
  status: ProcedureStatus;
  opened_at: string;
  deadline: string | null;
  tags: string[];
  responsible_name: string | null;
  stages_done: number;
  stages_total: number;
}

export interface PaginatedProcedures {
  items: ProcedureListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}
