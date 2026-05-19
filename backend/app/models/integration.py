"""
Modelos para integrações externas (Google Calendar OAuth2).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class GoogleCalendarToken(Base, TimestampMixin):
    """Armazena tokens OAuth2 do Google Calendar por usuário."""

    __tablename__ = "google_calendar_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expiry: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    calendar_id: Mapped[str] = mapped_column(
        String(256), nullable=False, default="primary"
    )
    scope: Mapped[str | None] = mapped_column(Text, nullable=True)

    # relationship (sem back_populates para evitar import circular com User)
    user: Mapped["User"] = relationship("User")  # type: ignore[name-defined]
