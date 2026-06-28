from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class ExtractedDocument(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "extracted_documents"

    procedure_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("procedures.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    property_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("properties.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    filename: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    content_type: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    doc_type: Mapped[str | None] = mapped_column(sa.String(80), nullable=True)
    doc_type_label: Mapped[str | None] = mapped_column(sa.String(150), nullable=True)
    extracted_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(sa.String(20), nullable=False, default="extraido")
    error_message: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
