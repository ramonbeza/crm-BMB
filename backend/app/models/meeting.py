import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class ReceptionType(str, Enum):
    presencial = "presencial"
    email = "email"
    whatsapp = "whatsapp"


class MeetingStatus(str, Enum):
    agendada = "agendada"
    realizada = "realizada"
    cancelada = "cancelada"


class Meeting(Base, UUIDMixin, TimestampMixin):
    """Agenda — reuniões com clientes."""
    __tablename__ = "meetings"

    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    reception_type: Mapped[str] = mapped_column(String(20), nullable=False, default=ReceptionType.presencial)
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=MeetingStatus.agendada, index=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    client = relationship("Client", foreign_keys=[client_id])
    user = relationship("User", foreign_keys=[user_id])
    attendances: Mapped[list["Attendance"]] = relationship(
        "Attendance", back_populates="meeting", cascade="all, delete-orphan"
    )


class Attendance(Base, UUIDMixin, TimestampMixin):
    """Atendimento — registro de decisões e pendências de uma reunião."""
    __tablename__ = "attendances"

    meeting_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="SET NULL"), nullable=True, index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    decisions: Mapped[str | None] = mapped_column(Text, nullable=True)
    pending_items: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Flag para a aba "pendentes de virar procedimento"
    converted_to_procedure: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    meeting: Mapped["Meeting | None"] = relationship("Meeting", back_populates="attendances")
    client = relationship("Client", foreign_keys=[client_id])
    user = relationship("User", foreign_keys=[user_id])
