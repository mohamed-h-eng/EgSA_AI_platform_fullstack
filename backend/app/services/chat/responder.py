"""The seam between chat persistence and the AI (plan §40–41, ADR-07).

The chat service only knows `ChatResponder`. `services/ai/responder.py` implements it on top of
the admin-configured OpenRouter connection; tests use a scripted fake.
"""

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol

from app.services.ai.base import StreamChunk


@dataclass(frozen=True)
class ChatTurn:
    role: str  # "user" | "assistant"
    content: str


@dataclass(frozen=True)
class ChatContext:
    """Metadata only (plan §24): the AI must NOT be told it knows the project's documents."""

    project_code: str | None = None
    project_name: str | None = None
    subsystem: str | None = None


@dataclass(frozen=True)
class Reply:
    content: str
    model: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


class ResponderError(Exception):
    """A failed AI call. `code` is stored on the assistant message and shown to the user."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class ChatResponder(Protocol):
    #: How many recent messages are sent back to the model as context.
    history_messages: int

    def resolve_model(self, requested: str | None) -> str | None:
        """The model to use; raises ResponderError(MODEL_NOT_ALLOWED) for a disallowed one."""
        ...

    def reply(self, turns: list[ChatTurn], context: ChatContext, model: str | None) -> Reply: ...

    def stream(
        self, turns: list[ChatTurn], context: ChatContext, model: str | None
    ) -> Iterator[StreamChunk]: ...
