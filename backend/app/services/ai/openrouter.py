"""OpenRouter client (OpenAI-compatible chat completions API).

The backend is the ONLY component that talks to OpenRouter (plan §18, D1): the API key never
reaches the browser. Transient failures (429 / 5xx / network) are retried a couple of times
before a stream starts; once tokens are flowing, a failure ends the stream with an error.
"""

import json
import logging
import ssl
import time
from collections.abc import Callable, Iterator
from typing import Any

import httpx

from app.services.ai.base import (
    AIProviderError,
    ChatMessages,
    Completion,
    KeyInfo,
    ModelInfo,
    StreamChunk,
)

log = logging.getLogger(__name__)

RETRY_STATUSES = {429, 500, 502, 503, 504}
MAX_ATTEMPTS = 3


def _error_from_response(response: httpx.Response) -> AIProviderError:
    try:
        detail = response.json().get("error", {}).get("message") or ""
    except (ValueError, AttributeError):
        detail = ""
    status = response.status_code
    if status == 401:
        return AIProviderError(
            "AI_AUTH_FAILED", "OpenRouter rejected the API key. Check the AI settings."
        )
    if status == 402:
        return AIProviderError(
            "AI_NO_CREDITS", "The OpenRouter account has insufficient credits for this model."
        )
    if status == 429:
        return AIProviderError(
            "AI_RATE_LIMITED",
            "The free AI model is busy, please retry in a moment.",
            retryable=True,
        )
    if status in (400, 404) and "model" in detail.lower():
        return AIProviderError(
            "AI_MODEL_NOT_FOUND", "The selected AI model is not available on OpenRouter."
        )
    if status >= 500:
        return AIProviderError(
            "AI_UNAVAILABLE", "The AI service is unavailable right now.", retryable=True
        )
    return AIProviderError("AI_REQUEST_FAILED", detail or f"AI request failed ({status}).")


def _is_free(model: dict[str, Any]) -> bool:
    pricing = model.get("pricing") or {}
    try:
        priced_free = (
            float(pricing.get("prompt", 1)) == 0 and float(pricing.get("completion", 1)) == 0
        )
    except (TypeError, ValueError):
        priced_free = False
    return priced_free or str(model.get("id", "")).endswith(":free")


class OpenRouterProvider:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        timeout: float = 60.0,
        app_url: str = "http://localhost",
        app_title: str = "EgSA AI Engineering Platform",
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(timeout, connect=10.0),
            headers={
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": app_url,
                "X-Title": app_title,
            },
            transport=transport,
            # Trust the OS certificate store (not only certifi's bundle): on internal networks
            # a TLS-inspecting proxy's CA is installed system-wide (D1, backend/certs/).
            verify=ssl.create_default_context(),
        )
        self._sleep = sleep

    # ── Transport with retries ───────────────────────────

    def _send(
        self, method: str, path: str, *, stream: bool = False, **kwargs: Any
    ) -> httpx.Response:
        last_error: AIProviderError | None = None
        for attempt in range(MAX_ATTEMPTS):
            try:
                request = self._client.build_request(method, path, **kwargs)
                response = self._client.send(request, stream=stream)
            except httpx.TimeoutException:
                last_error = AIProviderError(
                    "AI_TIMEOUT", "The AI service took too long to respond.", retryable=True
                )
            except httpx.TransportError:
                last_error = AIProviderError(
                    "AI_UNAVAILABLE", "Cannot reach the AI service.", retryable=True
                )
            else:
                if response.is_success:
                    return response
                if stream:
                    response.read()
                last_error = _error_from_response(response)
                response.close()
            if not last_error.retryable or attempt == MAX_ATTEMPTS - 1:
                break
            self._sleep(0.5 * 2**attempt)
        assert last_error is not None
        raise last_error

    # ── API ───────────────────────────────────────────────

    def check_key(self) -> KeyInfo:
        data = self._send("GET", "/key").json().get("data") or {}
        return KeyInfo(label=data.get("label"), is_free_tier=data.get("is_free_tier"))

    def list_models(self) -> list[ModelInfo]:
        payload = self._send("GET", "/models").json()
        models = []
        for item in payload.get("data", []):
            models.append(
                ModelInfo(
                    id=item["id"],
                    name=item.get("name") or item["id"],
                    context_length=item.get("context_length"),
                    is_free=_is_free(item),
                )
            )
        return models

    def _body(
        self, messages: ChatMessages, model: str, temperature: float, max_tokens: int, stream: bool
    ) -> dict[str, Any]:
        return {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
            "usage": {"include": True},  # token counts for usage tracking (D11)
        }

    def complete(
        self, messages: ChatMessages, *, model: str, temperature: float, max_tokens: int
    ) -> Completion:
        data = self._send(
            "POST",
            "/chat/completions",
            json=self._body(messages, model, temperature, max_tokens, False),
        ).json()
        if "error" in data:
            raise AIProviderError("AI_REQUEST_FAILED", str(data["error"].get("message", "")))
        choice = (data.get("choices") or [{}])[0]
        usage = data.get("usage") or {}
        return Completion(
            content=(choice.get("message") or {}).get("content") or "",
            model=data.get("model") or model,
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
        )

    def stream(
        self, messages: ChatMessages, *, model: str, temperature: float, max_tokens: int
    ) -> Iterator[StreamChunk]:
        response = self._send(
            "POST",
            "/chat/completions",
            stream=True,
            json=self._body(messages, model, temperature, max_tokens, True),
        )
        try:
            for line in response.iter_lines():
                # Blank lines separate events; ":" lines are keep-alive comments.
                if not line or line.startswith(":") or not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                chunk = json.loads(data)
                if "error" in chunk:
                    raise AIProviderError(
                        "AI_REQUEST_FAILED",
                        str(chunk["error"].get("message") or "The AI stream failed."),
                    )
                choice = (chunk.get("choices") or [{}])[0]
                usage = chunk.get("usage") or {}
                yield StreamChunk(
                    delta=(choice.get("delta") or {}).get("content") or "",
                    model=chunk.get("model"),
                    prompt_tokens=usage.get("prompt_tokens"),
                    completion_tokens=usage.get("completion_tokens"),
                )
        except httpx.TimeoutException as exc:
            raise AIProviderError("AI_TIMEOUT", "The AI stream stopped responding.") from exc
        except httpx.TransportError as exc:
            raise AIProviderError(
                "AI_UNAVAILABLE", "The connection to the AI service dropped."
            ) from exc
        finally:
            response.close()  # also cancels the upstream request if the client went away
