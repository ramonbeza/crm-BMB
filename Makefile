# =============================================================================
# Makefile — CRM Beza, Miranda e Bonetti
#
# Desenvolvimento:  make up | make down | make logs | make shell-backend
# Produção:         make prod-up | make deploy | make renew
# =============================================================================

COMPOSE      = docker compose
COMPOSE_PROD = docker compose -f docker-compose.yml -f docker-compose.prod.yml
BACKEND      = backend-1

.PHONY: help up down build logs shell-backend shell-db psql \
        prod-up prod-down deploy renew renew-cron \
        migrate migrate-new backup restore \
        test lint format clean

# ─── Ajuda ───────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  CRM-BMB — Comandos disponíveis"
	@echo "  ═══════════════════════════════════════════════════════════════"
	@echo "  DESENVOLVIMENTO"
	@echo "    make up              Sobe todos os serviços (dev)"
	@echo "    make down            Para todos os serviços"
	@echo "    make build           Reconstrói imagens sem subir"
	@echo "    make logs            Acompanha logs de todos os serviços"
	@echo "    make shell-backend   Abre shell no container backend"
	@echo "    make psql            Abre psql no container db"
	@echo "    make migrate         Aplica migrations pendentes"
	@echo "    make migrate-new m=desc  Cria nova migration"
	@echo ""
	@echo "  PRODUÇÃO"
	@echo "    make prod-up         Sobe em modo produção (sem rebuild)"
	@echo "    make prod-down       Para todos os serviços de produção"
	@echo "    make deploy          Pull + build + migra + reinicia"
	@echo "    make renew           Renova certificados Let's Encrypt"
	@echo "    make renew-cron      Instala cron de renovação automática"
	@echo ""
	@echo "  BANCO DE DADOS"
	@echo "    make backup          Dump do banco para ./backups/"
	@echo "    make restore f=...   Restaura dump (ex: f=backups/2025.sql.gz)"
	@echo ""
	@echo "  QUALIDADE"
	@echo "    make test            Roda testes do backend (pytest)"
	@echo "    make lint            Ruff + mypy no backend"
	@echo "    make format          Ruff format no backend"
	@echo ""

# ─── Desenvolvimento ─────────────────────────────────────────────────────────
up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build --parallel

logs:
	$(COMPOSE) logs -f --tail=100

logs-%:
	$(COMPOSE) logs -f --tail=100 $*

shell-backend:
	$(COMPOSE) exec backend bash

shell-db:
	$(COMPOSE) exec db bash

psql:
	$(COMPOSE) exec db psql -U $${POSTGRES_USER:-crm_user} $${POSTGRES_DB:-crm_beza}

# ─── Migrations ──────────────────────────────────────────────────────────────
migrate:
	$(COMPOSE) exec backend alembic upgrade head

migrate-new:
	@[ -n "$(m)" ] || (echo "Use: make migrate-new m=descricao"; exit 1)
	$(COMPOSE) exec backend alembic revision --autogenerate -m "$(m)"

migrate-down:
	$(COMPOSE) exec backend alembic downgrade -1

migrate-history:
	$(COMPOSE) exec backend alembic history --verbose

# ─── Produção ────────────────────────────────────────────────────────────────
prod-up:
	$(COMPOSE_PROD) up -d

prod-down:
	$(COMPOSE_PROD) down

deploy:
	@chmod +x scripts/deploy.sh
	@./scripts/deploy.sh

deploy-no-pull:
	@chmod +x scripts/deploy.sh
	@./scripts/deploy.sh --no-pull

renew:
	$(COMPOSE_PROD) run --rm certbot renew --webroot -w /var/www/certbot
	$(COMPOSE_PROD) exec nginx nginx -s reload

renew-cron:
	@echo "Instalando cron de renovação Let's Encrypt (2x por dia)..."
	@(crontab -l 2>/dev/null; echo "0 3,15 * * * cd $(shell pwd) && make renew >> /var/log/certbot-renew.log 2>&1") | crontab -
	@echo "Cron instalado. Verifique: crontab -l"

init-ssl:
	@chmod +x scripts/init-letsencrypt.sh
	@./scripts/init-letsencrypt.sh

# ─── Banco de dados ──────────────────────────────────────────────────────────
backup:
	@mkdir -p backups
	@FILENAME=backups/crm_beza_$(shell date +%Y%m%d_%H%M%S).sql.gz; \
	  $(COMPOSE) exec -T db pg_dump -U $${POSTGRES_USER:-crm_user} $${POSTGRES_DB:-crm_beza} | gzip > $$FILENAME; \
	  echo "✅  Backup salvo em $$FILENAME"

restore:
	@[ -n "$(f)" ] || (echo "Use: make restore f=backups/arquivo.sql.gz"; exit 1)
	@echo "⚠️  Restaurando $$(f)... isso sobrescreve o banco atual!"
	@read -p "Confirma? [s/N] " ans; [ "$$ans" = "s" ] || exit 1
	@gunzip -c $(f) | $(COMPOSE) exec -T db psql -U $${POSTGRES_USER:-crm_user} $${POSTGRES_DB:-crm_beza}
	@echo "✅  Banco restaurado de $(f)"

# ─── Qualidade ───────────────────────────────────────────────────────────────
test:
	$(COMPOSE) exec backend python -m pytest -x -q app/tests/

lint:
	$(COMPOSE) exec backend ruff check app/
	$(COMPOSE) exec backend python -m mypy app/ --ignore-missing-imports

format:
	$(COMPOSE) exec backend ruff format app/

# ─── Limpeza ─────────────────────────────────────────────────────────────────
clean:
	$(COMPOSE) down -v --remove-orphans
	docker image prune -f
