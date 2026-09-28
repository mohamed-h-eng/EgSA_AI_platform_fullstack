import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin, utcnow
from app.models.project import Project


class ConversationVisibility(StrEnum):
    """Only PRIVATE in the POC (owner-only). PROJECT/SHARED are reserved for later (plan §27)."""

    PRIVATE = "private"
    PROJECT = "project"
    SHARED = "shared"


class MessageRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class MessageStatus(StrEnum):
    COMPLETE = "complete"
    STREAMING = "streaming"  # phase 07 (SSE)
    ERROR = "error"


class Conversation(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "conversations"
    __table_args__ = (Index("ix_conversations_user_id_updated_at", "user_id", "updated_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    # True until the first user message sets an automatic title (a manual rename clears it).
    title_is_default: Mapped[bool] = mapped_column(default=True)
    visibility: Mapped[str] = mapped_column(String(16), default=ConversationVisibility.PRIVATE)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped[Project | None] = relationship(lazy="joined")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        order_by="Message.position",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class Message(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "messages"
    # Explicit per-conversation order: timestamps can collide, chat order must not.
    __table_args__ = (
        UniqueConstraint(
            "conversation_id", "position", name="uq_messages_conversation_id_position"
        ),
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    model: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(16), default=MessageStatus.COMPLETE)
    error_code: Mapped[str | None] = mapped_column(String(64))
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
