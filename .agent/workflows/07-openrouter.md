# Phase 07: OpenRouter Integration (2–3 days)

**Goal:** Replace the stub responder with a real free model through OpenRouter, reached only from the backend. Plan §17–20, §24, §26, and §41.

## Prerequisites
Phase 06 done. `OPENROUTER_API_KEY` is available in backend env.

## Backend
- [ ] `services/ai/base.py`: `AIProvider` protocol
  ```python
  class AIProvider(Protocol):
      async def list_models(self) -> list[ModelInfo]: ...
      async def complete(self, messages, model, **opts) -> Completion: ...
      def stream(self, messages, model, **opts) -> AsyncIterator[Delta]: ...
  ```
- [ ] `services/ai/openrouter.py` `OpenRouterProvider` built on httpx.AsyncClient with base URL and key from settings, timeouts, and 1–2 retries on 429/5xx with backoff. Add the `HTTP-Referer` and `X-Title` headers. Map provider errors to `AIProviderError` codes (`AI_UNAVAILABLE`, `AI_RATE_LIMITED`, `AI_MODEL_NOT_FOUND`, `AI_TIMEOUT`).
- [ ] `list_models()` fetches `/models`, filters to free models (pricing = 0 or a `:free` suffix), and caches the result for about 10 minutes.
- [ ] `AISettings` table (single row: default_model, allowed_models[], system_prompt, temperature, max_tokens, max_history_messages). Seed it from env `DEFAULT_AI_MODEL`. Env is the fallback and the DB row overrides it.
- [ ] `AIUsage` table (user_id, conversation_id, model, prompt_tokens, completion_tokens, latency_ms, status, created_at) for usage tracking.
- [ ] Context builder in `services/chat/context.py`:
  1. Base system prompt, which must be honest that the assistant has **no access to EgSA documents**.
  2. When the conversation has a project, add `Current project: {code}\nSubsystem: {subsystem}` as metadata only (plan §24).
  3. The last N messages of history.
- [ ] Swap `EchoResponder` for `AIResponder(provider)`. On failure, save the assistant message with `status=error` and `error_code`, and return a structured error. The user message is kept.
- [ ] Model selection: `POST /conversations/{id}/messages` accepts an optional `model` that must be in `allowed_models`. The chosen model is recorded on the message.
- [ ] Routes:
  ```text
  GET  /api/v1/ai/models                 chat:use      (allowed free models + default)
  GET  /api/v1/admin/ai/config           settings:manage
  PUT  /api/v1/admin/ai/config           settings:manage
  ```
- [ ] **Streaming is the main path (D5):** `POST /conversations/{id}/messages/stream` returns an SSE `text/event-stream` with events `start` (message ids), `delta` (text), `done` (usage), and `error`.
  - The user message is saved before streaming starts. The assistant message is created with `status=streaming`, then updated when the stream completes, errors, or the client disconnects (partial content kept, `status=error`/`aborted`).
  - Handle client disconnects (`request.is_disconnected()`) and cancel the upstream request.
  - Nginx: `proxy_buffering off`, `X-Accel-Buffering: no`, and a longer `proxy_read_timeout` for this route.
  - The non-streaming `POST /conversations/{id}/messages` stays as the fallback and for tests.
- [ ] **Rate limits (D11):** on an OpenRouter 429, return `AI_RATE_LIMITED` with a friendly "The free AI model is busy, please retry in a moment." No per-user caps. Usage is tracked only.
- [ ] System prompt addition (D3): "Reply in the language the user writes in (Arabic or English)."
- [ ] Audit: `ai.request` (model, tokens, status), plus `settings.ai_update`.

## Frontend: `features/settings` (AI part)
- [ ] `pages/AdminSettingsPage.tsx`, AI section: default model select (from `/ai/models`), allowed models checklist, system prompt textarea, and max tokens. Guarded by `settings:manage`. Uses the purple AI accent sparingly.
- [ ] `manifest.ts`: `/admin/settings`, admin nav "Settings".

## Verification
- Sending a message streams a real model reply, and the reply is saved with its model name and token counts.
- Closing the tab mid-stream keeps the partial reply saved and cancels the upstream request.
- An Arabic question gets an Arabic answer, stored intact.
- The API key never appears in any frontend bundle or network response (grep `dist/`).
- With an invalid key or unreachable OpenRouter, the user sees a friendly error, the conversation is intact, and an audit/usage row with the error status is written.
- Changing the default model in admin settings takes effect without a restart.
- Tests use a **mocked provider** (no real network calls in CI) and cover success, timeout, 429, and unknown model.

## Deliverable
Conversation → Messages → OpenRouter → saved response.

## Out of scope
AI orchestrator, RAG, citations, full model-management dashboard, benchmarking.
