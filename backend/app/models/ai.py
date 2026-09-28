import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, UUIDPrimaryKeyMixin, utcnow

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

DEFAULT_SYSTEM_PROMPT = (
    "You are the EgSA AI Engineering Assistant, helping engineers at the Egyptian Space "
    "Agency. Answer engineering questions clearly, precisely and concisely. When you are not "
    "sure, say so instead of guessing."
)


class AISettings(Base):
    """Single-row AI configuration, edited by admins in Admin Settings (phase 07).

    The OpenRouter connection is entered here manually (not via environment variables);
    the API key is stored encrypted and never returned by the API.
    """

    __tablename__ = "ai_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    provider: Mapped[str] = mapped_column(String(32), default="openrouter")
    base_url: Mapped[str] = mapped_column(String(255), default=OPENROUTER_BASE_URL)
    api_key_encrypted: Mapped[str | None] = mapped_column(Text)
    api_key_hint: Mapped[str | None] = mapped_column(String(16))
    default_model: Mapped[str | None] = mapped_column(String(128))
    allowed_models: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), default=list
    )
    system_prompt: Mapped[str] = mapped_column(Text, default=DEFAULT_SYSTEM_PROMPT)
    temperature: Mapped[float] = mapped_column(Float, default=0.3)
    max_tokens: Mapped[int] = mapped_column(Integer, default=1024)
    history_messages: Mapped[int] = mapped_column(Integer, default=20)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class AIUsage(UUIDPrimaryKeyMixin, Base):
    """One row per AI request, successful or not (decision D11: track, no limits)."""

    __tablename__ = "ai_usage"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("conversations.id", ondelete="SET NULL")
    )
    model: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(16))  # complete | error
    error_code: Mapped[str | None] = mapped_column(String(64))
    streamed: Mapped[bool] = mapped_column(default=False)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    meta: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), default=dict
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
