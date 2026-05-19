# Deploy em Produção — CRM Beza, Miranda e Bonetti

Guia passo-a-passo para implantar o CRM num VPS (Hetzner CX21 / DigitalOcean Droplet 2 vCPU 4 GB).

---

## 1. Requisitos do servidor

| Item | Mínimo | Recomendado |
|---|---|---|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disco | 40 GB SSD | 80 GB SSD |
| Firewall | 22, 80, 443 | + ICMP |

---

## 2. Preparação do servidor (primeira vez)

```bash
# Atualiza o sistema
sudo apt update && sudo apt upgrade -y

# Instala Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Instala docker compose plugin
sudo apt install -y docker-compose-plugin

# Cria usuário de deploy (opcional mas recomendado)
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh

# Configura firewall
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

---

## 3. Clona o repositório

```bash
# No servidor
cd /opt
sudo mkdir crm-beza && sudo chown deploy:deploy crm-beza
sudo -u deploy git clone git@github.com:SEU_ORG/crm-beza.git
cd crm-beza
```

---

## 4. Configura o `.env`

```bash
cp .env.example .env
nano .env
```

Preencha **todos** os campos marcados com `<CHANGE_ME>`. Dica para gerar senhas seguras:

```bash
openssl rand -base64 32   # use para POSTGRES_PASSWORD, REDIS_PASSWORD, MINIO_ROOT_PASSWORD
openssl rand -hex 32      # use para SECRET_KEY
```

---

## 5. Configura o DNS

No painel do seu registrador (Registro.br, Cloudflare, etc.), aponte:

```
crm.bezamiranda.com.br  →  A  →  <IP_DO_VPS>
www.crm.bezamiranda.com.br  →  CNAME  →  crm.bezamiranda.com.br
```

> ⚠️ Aguarde a propagação DNS antes de prosseguir (use `dig crm.bezamiranda.com.br` para verificar).

---

## 6. Obtém o certificado SSL (primeira vez)

```bash
make init-ssl
```

Este script:
1. Sobe o Nginx em modo HTTP
2. Obtém o certificado Let's Encrypt via webroot challenge
3. Sobe a stack completa com HTTPS

---

## 7. Verificação pós-deploy

```bash
# Verifica serviços
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Verifica logs
make logs

# Teste de saúde
curl https://crm.bezamiranda.com.br/health

# Teste SSL (nota A ou A+)
# https://www.ssllabs.com/ssltest/analyze.html?d=crm.bezamiranda.com.br
```

---

## 8. Renovação automática de certificados

```bash
# Instala cron (executar UMA vez no servidor)
make renew-cron

# Renovação manual (se necessário)
make renew
```

---

## 9. Deploy de atualizações

Para toda atualização futura:

```bash
cd /opt/crm-beza
make deploy
```

O `deploy` faz:
1. `git pull`
2. Build das imagens
3. `alembic upgrade head`
4. Reinicia backend + celery + frontend
5. Reload do nginx (sem downtime)
6. Smoke test no `/health`

---

## 10. Backup do banco de dados

```bash
# Backup manual
make backup
# Salvo em: ./backups/crm_beza_YYYYMMDD_HHMMSS.sql.gz

# Cron de backup diário às 2h (adicione no servidor)
echo "0 2 * * * cd /opt/crm-beza && make backup >> /var/log/crm-backup.log 2>&1" | crontab -
```

---

## 11. Acesso ao MinIO (console)

O console do MinIO (porta 9001) fica desabilitado em produção. Para acessar, use um túnel SSH:

```bash
# No seu computador local
ssh -L 9001:localhost:9001 deploy@<IP_DO_VPS>

# Agora acesse: http://localhost:9001
# Credenciais: MINIO_ROOT_USER / MINIO_ROOT_PASSWORD do .env
```

---

## 12. Monitoramento básico

```bash
# Recursos do servidor
docker stats

# Espaço em disco
df -h

# Logs por serviço
make logs-backend
make logs-nginx
make logs-db

# Reiniciar um serviço específico
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend
```

---

## Solução de problemas

| Problema | Verificar |
|---|---|
| 502 Bad Gateway | `make logs-backend` — backend crashou? |
| Certificado expirado | `make renew` — certificado venceu? |
| Banco cheio | `df -h` — `/var/lib/docker/volumes` |
| Lentidão | `docker stats` — memória/CPU |
| Migrations falharam | `docker compose exec backend alembic history` |
