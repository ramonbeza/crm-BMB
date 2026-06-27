# Deploy no Railway

## Serviços a criar no Railway

Crie um projeto no Railway e adicione **5 serviços**:

| Serviço | Tipo | Root Directory |
|---|---|---|
| `backend` | GitHub (Docker) | `backend/` |
| `frontend` | GitHub (Docker) | `frontend/` |
| `worker` | GitHub (Docker) | `backend/` |
| `postgres` | Plugin PostgreSQL | — |
| `redis` | Plugin Redis | — |

---

## Passo a passo

### 1. Crie o projeto e adicione os plugins

No painel do Railway:
- **New Project → Empty Project**
- Clique em **+ Add a Service → Database → PostgreSQL**
- Clique em **+ Add a Service → Database → Redis**

### 2. Serviço: `backend`

- **+ Add a Service → GitHub Repo** → selecione este repositório
- Em Settings:
  - **Root Directory**: `backend`
  - **Dockerfile Path**: `Dockerfile`
- Clique em **Deploy** uma vez para gerar a URL pública (ex: `https://crm-backend-xxxx.up.railway.app`)

**Variáveis de ambiente** (Settings → Variables):

```
DATABASE_URL=postgresql+asyncpg://<user>:<pass>@<host>:<port>/<db>
DATABASE_URL_SYNC=postgresql+psycopg2://<user>:<pass>@<host>:<port>/<db>
REDIS_URL=redis://:<pass>@<host>:<port>/0
SECRET_KEY=<openssl rand -hex 32>
ENVIRONMENT=production
FRONTEND_URL=https://<url-do-frontend>.up.railway.app
FIRST_ADMIN_EMAIL=admin@bezamiranda.com.br
FIRST_ADMIN_PASSWORD=<senha-forte>
FIRST_ADMIN_NAME=Administrador
GOOGLE_REDIRECT_URI=https://<url-do-backend>.up.railway.app/api/v1/integrations/google/callback
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-5
```

> **Dica**: O Railway preenche automaticamente as vars do PostgreSQL e Redis nos plugins.
> Copie os valores de `DATABASE_URL` do plugin PostgreSQL e ajuste o prefixo:
> - `postgresql://` → `postgresql+asyncpg://` (para DATABASE_URL)
> - `postgresql://` → `postgresql+psycopg2://` (para DATABASE_URL_SYNC)

### 3. Serviço: `frontend`

- **+ Add a Service → GitHub Repo** → mesmo repositório
- Em Settings:
  - **Root Directory**: `frontend`
  - **Dockerfile Path**: `Dockerfile`

**Variáveis de ambiente** (Settings → Variables → Build Variables):

```
VITE_API_URL=https://<url-do-backend>.up.railway.app/api/v1
VITE_WS_URL=wss://<url-do-backend>.up.railway.app
```

### 4. Serviço: `worker` (Celery + Beat)

- **+ Add a Service → GitHub Repo** → mesmo repositório
- Em Settings:
  - **Root Directory**: `backend`
  - **Dockerfile Path**: `Dockerfile`
  - **Start Command**: `celery -A app.worker.celery_app worker --beat --loglevel=info --concurrency=2`

**Variáveis de ambiente** (mesmas do backend, sem FRONTEND_URL):

```
DATABASE_URL=<mesma do backend>
DATABASE_URL_SYNC=<mesma do backend>
REDIS_URL=<mesma do backend>
SECRET_KEY=<mesma do backend>
ENVIRONMENT=production
```

### 5. Atualize o FRONTEND_URL no backend

Após o frontend estar deployado e ter sua URL pública:
- Vá nas variáveis do serviço `backend`
- Atualize `FRONTEND_URL` com a URL real do frontend

---

## Google Calendar OAuth2

Atualize o URI de redirecionamento autorizado no Google Cloud Console:
```
https://<url-do-backend>.up.railway.app/api/v1/integrations/google/callback
```

---

## Domínio personalizado (opcional)

Em cada serviço, vá em **Settings → Networking → Custom Domain** e adicione seu domínio.
Configure os registros CNAME no seu provedor de DNS.
