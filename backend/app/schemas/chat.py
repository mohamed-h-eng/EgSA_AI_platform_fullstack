import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.conversation import ConversationVisibility, MessageRole, MessageStatus
from app.schemas.documents import ProjectRef

MAX_MESSAGE_CHARS = 20_000


class ConversationOut(BaseModel):
    id: uuid.UUID
    title: str
    project: ProjectRef | None
    visibility: ConversationVisibility
    message_count: int
    last_message_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ConversationCreate(BaseModel):
    project_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=200)


class ConversationUpdate(BaseModel):
    title: str = Field(max_length=200)

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Title is required.")
        return value


class MessageOut(BaseModel):
    id: uuid.UUID
    position: int
    role: MessageRole
    content: str
    model: str | None
    status: MessageStatus
    error_code: str | None
    prompt_tokens: int | None
    completion_tokens: int | None
    latency_ms: int | None
    created_at: datetime


class MessageCreate(BaseModel):
    # Stored exactly as sent (no normalization): Arabic/English/mixed round-trip unchanged (D3).
    content: str = Field(max_length=MAX_MESSAGE_CHARS)
    # Optional: one of the admin's allowed models; the default model when omitted.
    model: str | None = Field(default=None, max_length=128)

    @field_validator("content")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Message can't be empty.")
        return value


class RetryRequest(BaseModel):
    model: str | None = Field(default=None, max_length=128)


class SendResult(BaseModel):
    """The saved user message (None on retry) and the assistant reply (may be status=error)."""

    conversation: ConversationOut
    user_message: MessageOut | None
    assistant_message: MessageOut
