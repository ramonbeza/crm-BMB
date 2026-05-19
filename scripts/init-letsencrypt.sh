#!/usr/bin/env bash
# =============================================================================
# init-letsencrypt.sh — bootstrap dos certificados Let's Encrypt
#
# Execute UMA VEZ no servidor VPS após clonar o repositório e preencher o .env.
#
# Pré-requisitos:
#   • .env preenchido com DOMAIN e CERTBOT_EMAIL
#   • Domínio apontando para o IP do VPS (DNS propagado)
#   • Portas 80 e 443 abertas no firewall
#   • Docker e docker compose instalados
#
# Uso:
#   chmod +x scripts/init-letsencrypt.sh
#   ./scripts/init-letsencrypt.sh
# =============================================================================
set -euo pipefail

# Carrega variáveis do .env
if [ ! -f .env ]; then
  echo "❌  Arquivo .env não encontrado. Copie .env.example e preencha os valores."
  exit 1
fi
set -a; source .env; set +a

# Valida variáveis obrigatórias
: "${DOMAIN:?Defina DOMAIN no .env (ex: crm.bezamiranda.com.br)}"
: "${CERTBOT_EMAIL:?Defina CERTBOT_EMAIL no .env (ex: ti@bezamiranda.com.br)}"

CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
RSA_KEY_SIZE=4096

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CRM-BMB — inicialização Let's Encrypt"
echo "  Domínio : $DOMAIN"
echo "  E-mail  : $CERTBOT_EMAIL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Prepara a configuração do nginx com o domínio correto ────────────────
# Substitui o placeholder NGINX_DOMAIN pelo valor real em nginx.prod.conf
sed -i "s/NGINX_DOMAIN/$DOMAIN/g" nginx/nginx.prod.conf
echo "   nginx.prod.conf configurado para: $DOMAIN"

mkdir -p ./nginx/certbot/www ./nginx/certbot/conf

# ── 2. Verifica se já existe certificado válido ───────────────────────────────
if docker compose -f docker-compose.yml -f docker-compose.prod.yml \
     run --rm certbot certificates 2>&1 | grep -q "$DOMAIN"; then
  echo "✅  Certificado para $DOMAIN já existe. Pulando emissão."
  echo "    Para renovar: make renew"
  exit 0
fi

# ── 3. Sobe só o nginx em modo HTTP (para validar o desafio ACME) ─────────────
echo ""
echo "▶  Subindo Nginx em modo HTTP para validação ACME..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  up -d nginx

echo "   Aguardando nginx ficar pronto..."
sleep 5

# Confirma que o nginx responde na porta 80
if ! curl -sf --max-time 5 "http://$DOMAIN/.well-known/acme-challenge/test" \
     -o /dev/null -w "%{http_code}" 2>/dev/null | grep -qE "200|404"; then
  echo ""
  echo "⚠️  Nginx não respondeu em http://$DOMAIN"
  echo "   Verifique:"
  echo "   1. DNS propagado? (dig $DOMAIN)"
  echo "   2. Portas 80/443 abertas? (ufw status)"
  echo "   3. docker compose logs nginx"
  # Não abortamos — certbot tentará assim mesmo
fi

# ── 4. Obtém o certificado ───────────────────────────────────────────────────
echo ""
echo "▶  Solicitando certificado para $DOMAIN..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$CERTBOT_EMAIL" \
    --agree-tos \
    --no-eff-email \
    --rsa-key-size $RSA_KEY_SIZE \
    --domain "$DOMAIN" \
    --domain "www.$DOMAIN"

# ── 5. Sobe a stack completa ─────────────────────────────────────────────────
echo ""
echo "▶  Subindo a stack completa com HTTPS..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo ""
echo "✅  Deploy concluído!"
echo "   CRM disponível em: https://$DOMAIN"
echo ""
echo "   Próximos passos:"
echo "   • Configure um cron para renovação automática: make renew-cron"
echo "   • Verifique os logs: make logs"
echo "   • Teste SSL: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
