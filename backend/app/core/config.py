from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyUrl


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "CRM Beza, Miranda e Bonetti"
    ENVIRONMENT: str = "production"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str
    DATABASE_URL_SYNC: str

    # Redis
    REDIS_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False
    MINIO_BUCKET: str = "crm-files"

    # First admin (criado no startup se não existir)
    FIRST_ADMIN_EMAIL: str = "admin@crm.local"
    FIRST_ADMIN_PASSWORD: str = "Admin@123"
    FIRST_ADMIN_NAME: str = "Administrador"

    # ── Comunicações ──────────────────────────────────────────────────────────
    # SMTP (email)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "CRM Beza, Miranda e Bonetti"
    SMTP_TLS: bool = True

    # WhatsApp via Z-API (opcional)
    ZAPI_INSTANCE_ID: str = ""
    ZAPI_TOKEN: str = ""
    ZAPI_CLIENT_TOKEN: str = ""

    # WhatsApp via Evolution API (alternativa)
    EVOLUTION_API_URL: str = ""
    EVOLUTION_API_KEY: str = ""
    EVOLUTION_INSTANCE: str = ""

    # ── Google Calendar OAuth2 ────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost/api/v1/integrations/google/callback"

    # ── Claude / Anthropic API ────────────────────────────────────────────────
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-5"

    # ── Frontend URL (para CORS no Railway) ──────────────────────────────────
    FRONTEND_URL: str = "http://localhost"

    # ── D4Sign ────────────────────────────────────────────────────────────────
    D4SIGN_TOKEN_API: str = ""        # token de acesso à API
    D4SIGN_CRYPT_KEY: str = ""        # chave de criptografia do cofre
    D4SIGN_SAFE_UUID: str = ""        # UUID do cofre (safe) onde documentos ficam
    D4SIGN_WEBHOOK_SECRET: str = ""   # segredo para validar webhooks

    @property
    def d4sign_configured(self) -> bool:
        return bool(self.D4SIGN_TOKEN_API and self.D4SIGN_SAFE_UUID)


settings = Settings()
