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
