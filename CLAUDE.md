# CRM Beza, Miranda e Bonetti — Guia de Continuidade

> Leia este arquivo no início de cada nova sessão. Ele contém toda a arquitetura, decisões e estado atual do projeto.

---

## Visão Geral

Sistema web para escritório de advocacia imobiliária (Beza, Miranda e Bonetti) com empresa parceira despachante. 4 usuários internos + perfil `despachante-externo` (empresa com CNPJ distinto — acesso isolado). Acesso remoto, nível production-grade, arquitetura preparada para IA futura (Claude API).

**Diretório raiz:** `/Users/ramonbeza/crm-beza/`

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Backend | Python 3.12 + FastAPI (async) |
| ORM | SQLAlchemy 2.x async + Alembic |
| Banco | PostgreSQL 16 |
| Cache/Filas | Redis 7 + Celery |
| Arquivos | MinIO (S3-compatible) |
| Realtime | WebSockets (FastAPI native) — Sprint 5 |
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Estado | Zustand + TanStack Query v5 |
| Auth | JWT + Refresh Tokens + RBAC |
| Containers | Docker + Docker Compose |
| Proxy | Nginx |
| Deploy | VPS (Hetzner ou DigitalOcean) |

---

## Estrutura de Pastas

```
crm-beza/
├── docker-compose.yml          # Orquestração de todos os serviços
├── .env.example                # Template de variáveis de ambiente
├── .gitignore
├── CLAUDE.md                   # Este arquivo
├── nginx/
│   └── nginx.conf              # Proxy reverso: /api/ → backend, / → frontend
├── backend/
│   ├── Dockerfile              # Build + alembic upgrade head + initial_data + uvicorn
│   ├── requirements.txt
│   ├── alembic.ini             # Usa DATABASE_URL_SYNC do environment
│   ├── alembic/
│   │   ├── env.py              # Lê DATABASE_URL_SYNC do env
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 001_initial_schema.py   # Users, RefreshTokens, Clients, ClientsPF, ClientsPJ
│   └── app/
│       ├── main.py             # FastAPI app + CORS + router
│       ├── initial_data.py     # Cria primeiro admin (executado no startup)
│       ├── core/
│       │   ├── config.py       # Settings via pydantic-settings + .env
│       │   ├── security.py     # JWT, bcrypt, refresh token hashing
│       │   └── deps.py         # FastAPI dependencies: CurrentUser, AdminOnly, require_roles()
│       ├── db/
│       │   ├── base.py         # DeclarativeBase, UUIDMixin, TimestampMixin
│       │   └── session.py      # AsyncEngine, AsyncSessionLocal, get_session()
│       ├── models/
│       │   ├── user.py         # User, RefreshToken, UserRole enum
│       │   └── client.py       # Client, ClientPF, ClientPJ, ClientType enum
│       ├── schemas/
│       │   ├── auth.py         # LoginRequest, TokenResponse, RefreshRequest
│       │   ├── user.py         # UserCreate, UserUpdate, UserRead
│       │   └── client.py       # ClientPFCreate/Update/Read, ClientPJCreate/Update/Read, PaginatedClients
│       ├── crud/
│       │   ├── base.py         # CRUDBase genérico
│       │   ├── user.py         # crud_user: autenticação, refresh tokens
│       │   └── client.py       # crud_client: create_pf, create_pj, list_paginated, soft_delete
│       ├── api/v1/
│       │   ├── router.py       # Inclui auth, users, clients com prefix /api/v1
│       │   ├── auth.py         # POST /login, /refresh, /logout, GET /me
│       │   ├── users.py        # CRUD users (admin-only exceto self-update)
│       │   └── clients.py      # CRUD clientes PF e PJ
│       └── worker/
│           ├── celery_app.py   # Configuração Celery (broker=Redis)
│           └── tasks.py        # Placeholder — expandir Sprint 6
└── frontend/
    ├── Dockerfile              # Multi-stage: build Vite → serve estático
    ├── package.json
    ├── vite.config.ts          # Proxy /api → backend:8000
    ├── tailwind.config.js
    └── src/
        ├── main.tsx
        ├── App.tsx             # Roteamento: /login, /, /clientes, /clientes/novo, /clientes/:id
        ├── types/index.ts      # TypeScript interfaces: User, Client, PaginatedClients, etc.
        ├── lib/
        │   ├── api.ts          # Axios client + interceptors (auth header + auto-refresh)
        │   └── utils.ts        # cn(), formatDate(), formatCPF(), formatCNPJ()
        ├── store/authStore.ts  # Zustand: tokens, user, setTokens, logout
        ├── components/
        │   ├── Layout.tsx      # Sidebar + Outlet
        │   ├── Sidebar.tsx     # Nav links + info do usuário + botão logout
        │   └── ProtectedRoute.tsx
        └── pages/
            ├── LoginPage.tsx
            ├── DashboardPage.tsx
            ├── ClientsPage.tsx     # Listagem paginada com busca e filtro por tipo
            └── ClientFormPage.tsx  # Criação e edição PF/PJ
```

---

## Modelos de Dados

### User
```
id (UUID PK) | name | email (unique) | password_hash | role | is_active | created_at | updated_at
```

### RefreshToken
```
id (UUID PK) | user_id (FK) | token_hash (SHA-256 do token raw) | expires_at | revoked | created_at
```

### Client
```
id (UUID PK) | client_type (PF|PJ) | phone | email | notes | is_active | created_by_id (FK) | created_at | updated_at
```

### ClientPF (joined 1:1 com Client)
```
id (UUID PK) | client_id (FK unique) | name | cpf (unique) | birth_date | civil_status | rg | cnh | address
```

### ClientPJ (joined 1:1 com Client)
```
id (UUID PK) | client_id (FK unique) | company_name | cnpj (unique) | address
```

---

## Auth e RBAC

**Roles:** `admin` | `advogado` | `estagiario`

| Ação | admin | advogado | estagiario |
|---|---|---|---|
| Criar/gerenciar usuários | ✓ | ✗ | ✗ |
| CRUD clientes | ✓ | ✓ | ✓ |
| Desativar clientes | ✓ | ✓ | ✗ |
| Ver todos | ✓ | ✓ | ✓ |

**Fluxo JWT:**
1. `POST /api/v1/auth/login` → `access_token` (30 min) + `refresh_token` (7 dias, armazenado hasheado no DB)
2. `POST /api/v1/auth/refresh` → novo `access_token`
3. `POST /api/v1/auth/logout` → revoga o refresh token no DB

O frontend armazena `refresh_token` no `localStorage` via Zustand persist. O `access_token` fica só em memória (Zustand sem persist). O interceptor do Axios renova automaticamente o access token quando recebe 401.

---

## Endpoints da API

### Auth
```
POST   /api/v1/auth/login    → TokenResponse (access_token, refresh_token)
POST   /api/v1/auth/refresh  → AccessTokenResponse (access_token)
POST   /api/v1/auth/logout   → 204
GET    /api/v1/auth/me       → UserRead
```

### Users (admin-only exceto GET/:id e PUT/:id self)
```
GET    /api/v1/users/        → list[UserRead]
POST   /api/v1/users/        → UserRead 201
GET    /api/v1/users/{id}    → UserRead
PUT    /api/v1/users/{id}    → UserRead
DELETE /api/v1/users/{id}    → 204 (soft deactivate + revoke tokens)
```

### Clients
```
GET    /api/v1/clients/           → PaginatedClients (query: page, page_size, search, client_type, active_only)
POST   /api/v1/clients/pf         → ClientPFRead 201
POST   /api/v1/clients/pj         → ClientPJRead 201
GET    /api/v1/clients/{id}       → ClientPFRead | ClientPJRead
PUT    /api/v1/clients/{id}/pf    → ClientPFRead
PUT    /api/v1/clients/{id}/pj    → ClientPJRead
DELETE /api/v1/clients/{id}       → 204 (soft delete, admin/advogado only)
```

---

## Como Subir o Ambiente

```bash
# 1. Copiar e preencher .env
cp .env.example .env
# Editar SECRET_KEY, POSTGRES_PASSWORD, REDIS_PASSWORD, MINIO_ROOT_PASSWORD

# 2. Subir tudo
docker compose up -d --build

# 3. Verificar saúde
docker compose ps
curl http://localhost/health

# 4. Acessar
# Frontend:  http://localhost
# API docs:  http://localhost/docs
# Login:     admin@crm.local / Admin@123 (padrão do .env.example)
```

### Desenvolvimento local (sem Docker)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql+asyncpg://..." DATABASE_URL_SYNC="postgresql+psycopg2://..." ...
alembic upgrade head
python -m app.initial_data
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev  # http://localhost:5173 com proxy /api → :8000
```

---

## Alembic — Gerenciamento de Migrations

```bash
# Dentro do container backend ou com venv local ativado:

# Criar nova migration
alembic revision --autogenerate -m "descricao"

# Aplicar migrations
alembic upgrade head

# Reverter uma migration
alembic downgrade -1

# Ver histórico
alembic history --verbose
```

---

## Sprints

| Sprint | Status | Commit | Descrição |
|---|---|---|---|
| **Sprint 1** | ✅ | — | Docker + FastAPI + PostgreSQL + Redis + Nginx + Auth JWT+RBAC + CRUD Clientes |
| **Sprint 2** | ✅ | — | Agenda/Calendário (FullCalendar) + Atendimentos (Meeting/Attendance, pipeline básico) |
| **Sprint 3** | ✅ | — | Procedimentos + 8 Etapas padrão + Protocolo BMB-YYYY-0001 + ProcedureDetailPage |
| **Sprint 4** | ✅ | — | Imóveis + Checklist por tipo de procedimento + PropertyDetailPage |
| **Sprint 5** | ✅ | — | Orçamentos BMB-ORC-YYYY-0001 + Contratos de honorários + D4Sign stub |
| **Sprint 6** | ✅ | — | Gestão financeira: honorários, custas, repasse ao despachante externo |
| **Sprint 7** | ✅ | — | Comunicações: WhatsApp (Z-API/Evolution) + e-mail SMTP + notificações internas |
| **Sprint 8** | ✅ | `2255538` | Dashboard + Relatórios + exportação Excel + gestão de prazos |
| **Sprint 9** | ✅ | `6703249` | Integrações: Google Calendar OAuth2 + ViaCEP + BrasilAPI |
| **Sprint 10** | ✅ | `7f98902` | IA: Celery + Claude API — geração automática de documentos jurídicos |
| **Sprint 11** | ✅ | `fb19eec` | Despachante-externo RBAC: isolamento completo por role + executor assignment |
| **Sprint 12** | ✅ | `9b21488` | Deploy VPS: docker-compose.prod, HTTPS Let's Encrypt, Nginx prod, Makefile ops |
| **Sprint 13** | ✅ | `bd82295` | Gestão de usuários: UsersPage, UserFormModal, CNPJ, toggle ativo/inativo |
| **Sprint 14** | ✅ | `bd82295` | WebSocket notifications: ConnectionManager, NotificationBell, useNotificationsWS |
| **Sprint 15** | ✅ | `46c3acb` | WS push (Redis pub/sub), Celery Beat (deadlines 08h), Audit Log append-only |
| **Sprint 16** | ✅ | `cfb5769` | Busca global: GET /search — clientes, procedimentos, imóveis + GlobalSearch no header |
| **Sprint 17** | ✅ | `6616546` | D4Sign: assinatura digital de orçamentos/contratos + webhook HMAC + D4SignPanel |

---

## Briefing Expandido — Módulos identificados (Briefing_CRM_BMB_Expandido.docx)

### Perfis de usuário (atualização futura)
- `admin` → Acesso total
- `advogado` → Sem configurações do sistema; sem exclusão sem aprovação
- `assistente` (era `estagiario`) → Agenda, clientes, atendimentos, comunicações; SEM financeiro nem movimentação de etapas
- `despachante-externo` ⚠️ NOVO → Vê **apenas** procedimentos onde está atribuído como executor. SEM: financeiro, outros procedimentos, dados de outros clientes, comunicações do escritório

### Módulos por sprint futuro
- **Módulo 3 — Imóveis**: matrícula, INCRA, inscrição imobiliária, tipo (urbano/rural), confrontantes, proprietários, N procedimentos por imóvel
- **Módulo 7 — Checklists**: pré-configurado por tipo de procedimento; status por documento (pendente/recebido/aprovado); bloqueio de avançar etapas sem checklist completo
- **Módulo 5 — Orçamentos**: formato BMB-ORC-YYYY-0001; versionamento; validade; separação honorários escritório / despachante / custas; D4Sign para assinatura digital
- **Módulo 8 — Financeiro**: modelos fixo/parcelado/êxito/fixo+êxito; controle de parcelas; custas orçadas vs. realizadas; repasse ao despachante (contas a pagar)
- **Módulo 9 — Comunicações**: WhatsApp Business API (Z-API ou Evolution API); SMTP próprio; templates com variáveis dinâmicas; sino de notificações
- **Módulo 10 — Relatórios**: faturamento, inadimplência, taxa de conversão, tempo médio por etapa; exportação PDF/XLSX

### Identificadores padronizados
- Procedimento: `BMB-2025-0001` (sigla + ano + 4 dígitos) ← **já implementado no frontend**
- Orçamento: `BMB-ORC-2025-0001`
- Contrato: `BMB-CTR-2025-0001`
- Nota de repasse: `BMB-REP-2025-0001`
- Recibo: `BMB-REC-2025-0001`

### Integrações confirmadas como prioritárias
1. **WhatsApp Business API** (Z-API ou Evolution API) — com fallback e-mail
2. **D4Sign** (assinatura digital ICP-Brasil) — com fallback upload manual PDF
3. **Google Calendar** (OAuth 2.0 por usuário) — despachante-externo NÃO sincroniza

---

## Sprint 2 — Agenda & Atendimentos (próximo)

### Novos modelos necessários
- **Meeting** (agenda): `id, client_id, user_id, datetime, reception_type (presencial|email|whatsapp), subject, summary, created_at`
- **Attendance** (atendimento): `id, meeting_id, client_id, user_id, decisions, pending_items, converted_to_procedure, created_at`

### Novos endpoints
```
POST/GET/PUT/DELETE /api/v1/meetings/
POST/GET/PUT/DELETE /api/v1/attendances/
GET                 /api/v1/attendances/pending-procedures  (pendentes de virar procedimento)
```

### Frontend — Sprint 2
- Instalar FullCalendar: `npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction`
- Páginas: `MeetingsPage`, `MeetingFormPage`, `AttendancesPage`, `AttendanceFormPage`
- Sidebar: adicionar links Agenda e Atendimentos

---

## Sprint 3 — Procedimentos (referência rápida)

### 11 tipos de procedimento
1. Usucapião Judicial
2. Usucapião Extrajudicial
3. Retificação Administrativa
4. Loteamento
5. Desmembramento Rural
6. Desmembramento Urbano
7. Notificação Extrajudicial
8. Incorporação Imobiliária
9. Instituição Imobiliária
10. Inventário Extrajudicial
11. Divórcio

### 8 etapas padrão (todas)
1. Análise do caso / conferência do checklist
2. Elaboração da proposta de honorários/serviços
3. Elaboração e assinatura do contrato de honorários
4. Elaboração dos documentos (requerimentos, declarações, revisão técnica)
5. Orientação das partes quanto às assinaturas
6. Prenotação na Prefeitura e/ou cartório competente
7. Saneamento das exigências
8. Finalização e entrega do processo

### Campos do Protocolo
`numero_sequencial, client_id, procedure_type, date, property_description, matricula, incra, inscricao_imobiliaria, requerente, anexos, prazos, etiquetas`

---

## Sprint 6 — Camada de IA (referência)

Arquitetura planejada:
- **Redis Streams** como event bus (publicar evento a cada mudança de etapa)
- **Celery Worker** consome o stream e chama Claude API
- **Claude API** (`claude-opus-4-7` ou `claude-sonnet-4-6`) gera documentos automaticamente
- Documentos gerados: requerimentos, contratos, declarações, notificações extrajudiciais
- Armazenados no MinIO, referenciados no procedimento

---

## Decisões Técnicas Relevantes

1. **UUID v4** como PK em todas as tabelas (não auto-increment) — melhor para sharding futuro e exposição via API.
2. **Soft delete** em clients (`is_active=False`) — clientes nunca são deletados fisicamente.
3. **Joined table** para PF/PJ — separação limpa, permite queries eficientes por tipo sem nullable columns na tabela principal.
4. **Refresh tokens hasheados** (SHA-256) no banco — o token raw jamais é persitido, apenas enviado ao cliente.
5. **SQLAlchemy async** com `asyncpg` — performance máxima em operações I/O bound.
6. **Alembic usa psycopg2 síncrono** — Alembic não suporta async nativamente; `DATABASE_URL_SYNC` é a variável separada para isso.
7. **Celery com Redis** já configurado — broker pronto para o Sprint 6, sem necessidade de reconfigurar.
