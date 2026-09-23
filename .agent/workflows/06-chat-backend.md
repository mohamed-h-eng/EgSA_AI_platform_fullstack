# Phase 06: Chat Backend, without AI (3–4 days)

**Goal:** Conversation and message persistence, history, and permissions all working **independently of OpenRouter**. Plan §21–23, §27, and §40.

## Prerequisites
Phase 04 done (for project association).

## Backend
- [ ] Models:
  - `Conversation` (id, user_id, project_id nullable, title, visibility default `private`, last_message_at, created_at, updated_at, deleted_at nullable)
  - `Message` (id, conversation_id, role [user, assistant, system], content, model nullable, status [complete, error, streaming], error_code nullable, prompt_tokens, completion_tokens, latency_ms, created_at)
- [ ] Migration with an index on `(user_id, updated_at desc)`.
- [ ] `services/chat`:
  - create conversation (optional `project_id` requires `can_access_project`)
  - list own conversations (paginated, `q` on title, optional project filter), grouped by the client into Today / Yesterday / Previous 7 days / Older
  - get, rename, delete (soft)
  - add message; list messages (ordered)
  - `ChatService.send_message()` pipeline with a **pluggable responder**. In this phase the responder is an `EchoResponder` or a stub that returns a placeholder assistant message, which proves the flow end-to-end.
- [ ] Routes:
  ```text
  POST   /api/v1/conversations                     chat:use
  GET    /api/v1/conversations?q=&project_id=&page=
  GET    /api/v1/conversations/{id}                owner only → else 404
  PATCH  /api/v1/conversations/{id}                (rename)
  DELETE /api/v1/conversations/{id}                SOFT delete (D16) → deleted_at; 404 afterwards
  GET    /api/v1/conversations/{id}/messages
  POST   /api/v1/conversations/{id}/messages       { content } → { user_message, assistant_message }
  ```
- [ ] Flow (plan §22): check permission → save user message → load history → responder → save assistant message → return.
- [ ] Auto-title: the first user message, truncated to about 60 **characters** (Unicode-safe, not cut mid-grapheme, so Arabic works, D3). It can be replaced with an AI-generated title in 07.
- [ ] Content is stored as UTF-8 text without any direction or normalization changes. Arabic, English, and mixed messages round-trip unchanged.
- [ ] Extend the demo seed (D12) with 3–5 sample conversations per demo user (one partly Arabic), spread over Today, Yesterday, and last week so the history grouping shows.

## Frontend
Nothing here is required. A minimal `features/chat` API layer (`chat.api.ts`, query keys, types) may be scaffolded now to speed up phase 08.

## Verification
- Create a conversation, send messages, get the stub replies, reload, and confirm the history is intact.
- User A can't read, rename, or delete user B's conversation (404).
- Creating a conversation for a project the user isn't a member of is rejected.
- Tests cover all of the above.

## Deliverable
Chat history that works with no AI provider configured.

## Out of scope
OpenRouter, streaming, shared/project visibility.
