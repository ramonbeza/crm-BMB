#!/usr/bin/env bash
# =============================================================================
# deploy.sh — atualiza o CRM-BMB para a versão mais recente
#
# Uso:
#   ./scripts/deploy.sh              # puxa main e faz deploy
#   ./scripts/deploy.sh --no-pull    # só rebuilda (sem git pull)
# =============================================================================
set -euo pipefail

PULL=true
for arg in "$@"; do
  [[ "$arg" == "--no-pull" ]] && PULL=false
done

cd "$(git rev-parse --show-toplevel)"

if [ ! -f .env ]; then
  echo "❌  .env não encontrado."; exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CRM-BMB — deploy $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Atualiza código ────────────────────────────────────────────────────────
if $PULL; then
  echo "▶  git pull..."
  git pull --ff-only
fi

# ── 2. Build das imagens ──────────────────────────────────────────────────────
echo "▶  Buildando imagens..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  build --parallel

# ── 3. Aplica migrations (antes de trocar o container) ───────────────────────
echo "▶  Aplicando migrations..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  run --rm --no-deps backend \
  alembic upgrade head

# ── 4. Reinicia serviços (rolling — nginx fica de pé) ────────────────────────
echo "▶  Reiniciando backend e celery..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --no-deps backend celery_worker celery_beat frontend

echo "▶  Recarregando nginx (sem downtime)..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec -T nginx nginx -s reload

# ── 5. Smoke test ─────────────────────────────────────────────────────────────
echo "▶  Smoke test..."
set -a; source .env; set +a
HEALTH=$(curl -sf --max-time 10 "http://localhost/health" || echo "FAIL")
if echo "$HEALTH" | grep -q "ok\|healthy\|true"; then
  echo "✅  Deploy concluído com sucesso!"
else
  echo "⚠️  /health retornou: $HEALTH"
  echo "   Verifique: docker compose logs backend --tail=50"
fi

echo ""
git log -1 --format="Commit: %h %s (%cr)" HEAD
