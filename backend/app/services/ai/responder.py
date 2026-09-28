"""ChatResponder backed by the admin-configured AI provider (OpenRouter)."""

from collections.abc import Iterator

from sqlalchemy.orm import Session

from app.services.ai import settings as ai_settings
from app.services.ai.base import AIProvider, AIProviderError, ChatMessages, StreamChunk
from app.services.chat.responder import ChatContext, ChatTurn, Reply, ResponderError

# Always appended to the admin's system prompt: honesty and language rules can't be edited away.
GUARDRAILS = (
    "Important rules:\n"
    "- You do NOT have access to EgSA documents, project files, databases or any internal "
    "data. Never claim or imply that you have read them. If asked about them, say you can't "
    "access them yet.\n"
    "- Reply in the same language the user writes in (Arabic or English)."
)


def not_configured() -> ResponderError:
    return ResponderError(
        "AI_NOT_CONFIGURED",
        "The AI model hasn't been set up yet. Ask an administrator to add the OpenRouter "
        "connection in Admin Settings.",
    )


def build_messages(system_prompt: str, turns: list[ChatTurn], context: ChatContext) -> ChatMessages:
    system = f"{system_prompt.strip()}\n\n{GUARDRAILS}"
    if context.project_code:
        # Project metadata only (plan §24), never document content.
        lines = [f"Current project: {context.project_code}"]
        if context.project_name and context.project_name != context.project_code:
            lines[0] += f" ({context.project_name})"
        if context.subsystem:
            lines.append(f"Subsystem: {context.subsystem}")
        system += "\n\nConversation context:\n" + "\n".join(lines)
    return [{"role": "system", "content": system}] + [
        {"role": t.role, "content": t.content} for t in turns
    ]


def _as_responder_error(exc: AIProviderError) -> ResponderError:
    return ResponderError(exc.code, exc.message)


class AIResponder:
    def __init__(self, config: ai_settings.AIConfigSnapshot, provider: AIProvider | None) -> None:
        self.config = config
        self.provider = provider
        self.history_messages = config.history_messages

    def resolve_model(self, requested: str | None) -> str | None:
        if requested and requested not in self.config.allowed_models:
            raise ResponderError(
                "MODEL_NOT_ALLOWED", "This model isn't enabled. Choose one from the list."
            )
        return requested or self.config.default_model

    def _require_provider(self, model: str | None) -> tuple[AIProvider, str]:
        if self.provider is None or not model:
            raise not_configured()
        return self.provider, model

    def reply(self, turns: list[ChatTurn], context: ChatContext, model: str | None) -> Reply:
        provider, model = self._require_provider(model)
        try:
            completion = provider.complete(
                build_messages(self.config.system_prompt, turns, context),
                model=model,
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
            )
        except AIProviderError as exc:
            raise _as_responder_error(exc) from exc
        if not completion.content.strip():
            raise ResponderError("AI_EMPTY_RESPONSE", "The AI model returned an empty answer.")
        return Reply(
            content=completion.content,
            model=completion.model,
            prompt_tokens=completion.prompt_tokens,
            completion_tokens=completion.completion_tokens,
        )

    def stream(
        self, turns: list[ChatTurn], context: ChatContext, model: str | None
    ) -> Iterator[StreamChunk]:
        provider, model = self._require_provider(model)
        chunks = provider.stream(
            build_messages(self.config.system_prompt, turns, context),
            model=model,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
        )
        try:
            yield from chunks
        except AIProviderError as exc:
            raise _as_responder_error(exc) from exc
        finally:
            close = getattr(chunks, "close", None)
            if close:
                close()  # closes the upstream HTTP stream when the client goes away


def build_responder(db: Session) -> AIResponder:
    config = ai_settings.snapshot(db)
    provider = (
        ai_settings.make_provider(config.base_url, config.api_key) if config.api_key else None
    )
    return AIResponder(config, provider)
