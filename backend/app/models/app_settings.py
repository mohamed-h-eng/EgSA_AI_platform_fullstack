import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, utcnow


class AppSettings(Base):
    """Single-row admin settings (phase 09). NULL means "use the environment default"."""

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    max_upload_mb: Mapped[int | None] = mapped_column(Integer)
    allowed_file_types: Mapped[list[str] | None] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql")
    )
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
