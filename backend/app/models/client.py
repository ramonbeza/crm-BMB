import uuid
from datetime import date
from enum import Enum

from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class ClientType(str, Enum):
    PF = "PF"
    PJ = "PJ"


class Client(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "clients"

    client_type: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    pf_data: Mapped["ClientPF | None"] = relationship(
        "ClientPF", back_populates="client", uselist=False, cascade="all, delete-orphan"
    )
    pj_data: Mapped["ClientPJ | None"] = relationship(
        "ClientPJ", back_populates="client", uselist=False, cascade="all, delete-orphan"
    )
    created_by: Mapped["app.models.user.User | None"] = relationship("User", foreign_keys=[created_by_id])


class ClientPF(Base, UUIDMixin):
    """Dados específicos de Pessoa Física."""
    __tablename__ = "clients_pf"

    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    cpf: Mapped[str] = mapped_column(String(14), unique=True, nullable=False, index=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    civil_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    rg: Mapped[str | None] = mapped_column(String(30), nullable=True)
    cnh: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    client: Mapped["Client"] = relationship("Client", back_populates="pf_data")


class ClientPJ(Base, UUIDMixin):
    """Dados específicos de Pessoa Jurídica."""
    __tablename__ = "clients_pj"

    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    company_name: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    cnpj: Mapped[str] = mapped_column(String(18), unique=True, nullable=False, index=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    client: Mapped["Client"] = relationship("Client", back_populates="pj_data")
