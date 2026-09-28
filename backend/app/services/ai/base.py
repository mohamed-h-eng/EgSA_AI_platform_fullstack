"""AI provider interface (ADR-07). OpenRouter today; a local model or AI orchestrator later."""

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ModelInfo:
    id: str
    name: str
    context_length: int | None
    is_free: bool


@dataclass(frozen=True)
class Completion:
    content: str
    model: str
    prompt_tokens: int | None
    completion_tokens: int | None


@dataclass(frozen=True)
class StreamChunk:
    """A piece of a streamed answer. The last chunk usually carries usage and the model."""

    delta: str = ""
    model: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


class AIProviderError(Exception):
    """Provider failure with a stable, user-facing code."""

    def __init__(self, code: str, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable


ChatMessages = list[dict[str, str]]


@dataclass(frozen=True)
class KeyInfo:
    label: str | None
    is_free_tier: bool | None


class AIProvider(Protocol):
    def check_key(self) -> KeyInfo:
        """Validate the API key (the model catalog is public, so it can't be used for this)."""
        ...

    def list_models(self) -> list[ModelInfo]: ...

    def complete(
        self, messages: ChatMessages, *, model: str, temperature: float, max_tokens: int
    ) -> Completion: ...

    def stream(
        self, messages: ChatMessages, *, model: str, temperature: float, max_tokens: int
    ) -> Iterator[StreamChunk]: ...
