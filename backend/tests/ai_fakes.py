"""A scriptable in-memory AIProvider for chat/settings tests."""

from collections.abc import Iterator

from app.services.ai.base import (
    AIProviderError,
    ChatMessages,
    Completion,
    KeyInfo,
    ModelInfo,
    StreamChunk,
)

CATALOG = [
    ModelInfo(
        id="meta-llama/llama-free:free", name="Llama Free", context_length=8192, is_free=True
    ),
    ModelInfo(
        id="mistral/mistral-free:free", name="Mistral Free", context_length=32768, is_free=True
    ),
    ModelInfo(id="openai/gpt-paid", name="GPT Paid", context_length=128000, is_free=False),
]


class FakeProvider:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []
        self.fail: AIProviderError | None = None
        self.reply = "Hello from the model."
        self.stream_parts = ["Hello ", "from ", "the model."]
        self.fail_after_parts: AIProviderError | None = None
        self.api_key: str | None = None
        # Like the real API: the catalog is public, only /key rejects a bad key.
        self.key_rejected = False
        self.base_url: str | None = None

    def check_key(self) -> KeyInfo:
        if self.fail or self.key_rejected:
            raise self.fail or AIProviderError("AI_AUTH_FAILED", "OpenRouter rejected the API key.")
        return KeyInfo(label="test key", is_free_tier=True)

    def list_models(self) -> list[ModelInfo]:
        if self.fail:
            raise self.fail
        return CATALOG

    def complete(
        self, messages: ChatMessages, *, model: str, temperature: float, max_tokens: int
    ) -> Completion:
        self.calls.append({"messages": messages, "model": model, "stream": False})
        if self.fail:
            raise self.fail
        return Completion(content=self.reply, model=model, prompt_tokens=20, completion_tokens=5)

    def stream(
        self, messages: ChatMessages, *, model: str, temperature: float, max_tokens: int
    ) -> Iterator[StreamChunk]:
        self.calls.append({"messages": messages, "model": model, "stream": True})
        if self.fail:
            raise self.fail
        for i, part in enumerate(self.stream_parts):
            yield StreamChunk(delta=part, model=model if i == 0 else None)
        if self.fail_after_parts:
            raise self.fail_after_parts
        yield StreamChunk(prompt_tokens=20, completion_tokens=3)
