"""
AuditLog — registro imutável de ações críticas no sistema.
Usado para compliance e rastreabilidade (quem fez o quê, quando).
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # Quem fez
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # O quê
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # Sobre qual entidade
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    # Detalhes (diff de campos, payload relevante)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Metadados da request
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # Timestamp (sem updated_at — audit log é append-only)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
