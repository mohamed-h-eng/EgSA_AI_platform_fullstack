# Phase 12: Agents and Chat References (5–7 days)

**Goal:**
- **Agents:** reusable custom system prompts ("GPTs") that any user can create and optionally share with everyone.
- **References:** the chat box can point the AI at a project or document with `@` (or the ＋ button).

Design decision D19 (below).

## Prerequisites
Phases 08, 11 done. Read `rules/design-system.md`, `rules/ui-principles.md`, `rules/security-permissions.md`.

## Decisions (user, 2026-09-28): D19

| Question | Decision |
| -------- | -------- |
| Name | **Agents** (not "GPTs", which is OpenAI's product name). |
| Who creates agents | **Any user** (every role, including Viewers). |
| Sharing | Each agent is **Private** (only its creator) or **Public** (every user can use it). Only the creator can edit it; admins can edit, unpublish or delete any agent (moderation). |
| Switching | Agents **can be switched mid-chat**. The new agent applies from the next answer; earlier answers keep the agent that wrote them. |
| References | Via **`@` in the chat box** plus a **＋ button**; up to 5 per message; shown as removable tags. |
| Document content | **Details only** (code, title, revision, status, category, project, description). The AI does **not** read file contents; its guardrails say so (plan §25). Text extraction stays out of scope (it would send document content to an external provider, D1/D2). |
| Default | A built-in **"General"** agent is today's behavior (the admin's global prompt only); every existing chat uses it. |

## Concepts

### Agent

| Field | Rules |
| ----- | ----- |
| `name` | 2–60 chars. |
| `description` | ≤ 200 chars, shown on cards. |
| `icon`, `color` | A Lucide icon name from a short curated list, and a token color (blue / navy / green / amber / red / purple / gray). No uploads. |
| `instructions` | The system prompt: required, ≤ 8,000 chars, `dir="auto"` in the editor. |
| `default_model` | Optional. Must be in the admin's allow-list; if it's removed later, the global default is used silently. |
| `starters` | 0–4 suggested first messages, ≤ 200 chars each. |
| `visibility` | `private` or `public`. |
| `owner` | The user who created it. |
| `is_builtin` | Only for "General": not deletable, and only admins edit it (it mirrors the global prompt). |
| `deleted_at` | Soft delete. |

- **Prompt layering (order fixed; later layers can't remove earlier ones):**
  1. Guardrails (always).
  2. The admin's global prompt.
  3. The agent's instructions.
  4. Project context (the conversation's project).
  5. The reference block (this message's `@` items).
- **Visibility when used:** you can use your own agents plus all public ones.
  - If an agent becomes private, or is deleted, while other users' chats use it, those chats **fall back to General** from their next answer.
  - The chat shows a small notice: "*<name>* is no longer available; continuing with General."
  - Past answers keep the stored agent name, so the history stays truthful.
- **Duplicate:** any usable agent can be copied into a new private agent owned by you ("Make a copy"). This is the main way to build on a shared agent.

### Mid-chat switching
- `conversations.agent_id` holds the current agent; each assistant message stores `agent_id` + `agent_name` (a snapshot).
- Switching adds a divider in the transcript: "Switched to **Test Procedure Writer**".
  - It's stored as a lightweight `system_event` message (role `system`, never sent to the model), so reloads show it.
- The history sent to the model keeps earlier answers (they're context), under the new agent's instructions.

### References
- `POST …/messages`, `…/messages/stream`, and `PUT …/messages/{id}` (edit) accept `references: [{ type: 'project' | 'document', id }]` (max 5, no duplicates).
- The server re-checks each reference with the existing visibility rules. A hidden or unknown item gives **404 `REFERENCE_NOT_FOUND`** (and no message is saved).
- The context block is plain text, e.g. `Referenced document: EPS-SRS-001 "EPS Requirements" rev B, status Approved, category Requirements, project NEXSAT-1. Description: …`
  - The AI has these details only, never the file content.
- Stored in a `message_references` table (message_id, type, target_id, label snapshot). A reference whose target was later deleted still renders its label, greyed and unlinked.
- The AI's guardrails gain: "Referenced items are described by their details only; you have not read their contents."

## Backend
- **Migration 0008:**
  - `agents`;
  - `conversations.agent_id` (nullable = General);
  - `messages.agent_id`, `messages.agent_name`;
  - `message_references`;
  - a seed of built-in **General** plus 4 public starter agents owned by the seed admin: Requirements Reviewer, Test Procedure Writer, Design Review Checklist, Arabic ↔ English Technical Translator.
- **Permissions:**
  - `agents:use` and `agents:create` → all roles.
  - `agents:manage_any` → admin.
  - Re-run the seed (matrix sync already exists).
- **API (`/agents`):**
  - `GET /agents?scope=mine|public|all&q=`: usable agents; cards data plus owner name.
  - `POST /agents`, `GET/PATCH/DELETE /agents/{id}`: owner or `agents:manage_any`; others get 404 for private agents and 403 for public ones.
  - `POST /agents/{id}/duplicate`.
  - `POST /agents/preview`: runs the AI with unsaved instructions for the editor's test box (usage recorded, not saved).
  - Conversations:
    - `POST /conversations` takes an optional `agent_id`.
    - `PATCH /conversations/{id}` takes `agent_id` to switch; it writes the divider event.
- **Chat service:** resolves the agent per answer (with fallback), layers the prompt, uses the agent's model unless the user picked one, and stores `agent_id` / `agent_name` on the answer.
  - Records `agent_id` in `ai_usage.meta` for later analytics.
- **Audit:**
  - `agent.create`, `agent.update`, `agent.delete`, and `agent.visibility_change` (published or unpublished).
  - The audit coverage test (`test_every_audit_action_is_emitted_somewhere`) will enforce them.
  - References need no audit event: nothing is read or downloaded.

## Frontend: new `features/agents`
```text
features/agents/
├── index.ts          ← AgentPicker, AgentBadge, agentsFeature, useAgents
├── manifest.ts       ← /agents (gallery), /agents/new, /agents/:id/edit ; no sidebar item (see below)
├── api/  agents.api.ts  agents.queries.ts
├── model/types.ts  icons.ts
├── pages/  AgentsPage.tsx  AgentEditorPage.tsx
└── components/  AgentCard.tsx  AgentPicker.tsx  AgentBadge.tsx  AgentForm.tsx  AgentPreview.tsx
```
- **Agents page (`/agents`):**
  - Tabs **My agents** and **Public**, a search box, and a card grid (icon, name, description, owner, a Private/Public badge).
  - Actions: **Start chat**, **Edit** (own), **Make a copy**, **Delete** (own).
  - A **"New agent"** button.
  - Reached from the new-chat screen ("Browse agents") and from the agent picker.
  - The sidebar stays unchanged, per D18: no new nav item.
- **Agent editor:**
  - Name, description, icon and color picker, instructions (large textarea, character count), default model (allow-list), starters, and the visibility toggle.
  - Publishing asks for confirmation: "Everyone can use this agent."
  - A right-hand **Test** panel sends a sample message via `/agents/preview`.
- **New chat screen:**
  - An **agent row** (General plus your agents and recent/public ones, with "Browse agents →").
  - Picking one shows its starters as the suggested prompts; the project select stays.
- **Chat top bar:** an **agent badge dropdown** next to the title (icon + name ▾).
  - It lists your agents and public ones, and switching adds the divider.
  - The **model picker** stays; the agent's default model preselects it.
- **AI answers:** the label becomes "✦ AI Response · *Agent name*" (hover still shows Copy / Retry / time / Model).
- **Recents:** a small agent icon before chat titles that don't use General.

## Frontend: references in `features/chat`
- **`ChatComposer`:**
  - `@` opens a popover anchored at the caret row: grouped **Projects** / **Documents**, with a debounced search reusing the `/projects` and `/documents` list APIs.
  - ↑↓ Enter Esc keyboard support; ARIA combobox/listbox.
  - Selecting removes the typed `@query` and adds a **tag** above the textarea.
  - The **＋** button opens the same picker with its own search box.
  - `/` at the start of an empty box opens the **agent switcher** (same list as the badge).
- **Tags:**
  - Show the code and a short title with an ×; max 5 (the picker disables further items once the limit is reached).
  - Sent as `references` and cleared after sending.
  - On a user message bubble, references render as small linked chips (project → `/projects/:id`, document → `/documents/:id`).
- **Edit (latest message):** the edit box shows its tags and allows adding or removing them.
- **Arabic:** tag labels and search use `dir="auto"`.

## Docs to update
- `context/decisions.md`: **D19** (the table above).
- `rules/security-permissions.md`: the new permission codes, agent ownership/moderation rules, and the reference re-check.
- `rules/design-system.md`: agent cards, badge, chat-box tags, and the switch divider.
- `checklists/demo-acceptance.md`: add steps.
  - Create a private agent, publish it, and use it as another user.
  - Switch agents mid-chat.
  - `@`-reference a document.
  - A viewer can't reference a project they can't see.
- `progress.md`: row 12 and decision-log entries.
- README: a short "Agents" section.

## Tests
- **Backend:**
  - Agent CRUD and ownership; private agents are invisible to others (404); public agents are read-only for non-owners (403 on edit).
  - Admin moderation; built-in General is protected; duplicate.
  - Prompt layering: guardrails are always first and can't be removed by agent instructions.
  - Fallback when an agent is unpublished or deleted.
  - Mid-chat switch: divider stored; per-answer `agent_name`.
  - References: visibility re-check (404, nothing saved), max 5, dedupe, context block content, stored labels, deleted target.
  - Role × endpoint matrix rows for `/agents`; audit rows; migration `alembic check`.
- **Frontend:**
  - Gallery tabs and search; editor validation and the publish confirmation.
  - Agent picker on the new-chat screen and its starters; the badge switch and divider.
  - Composer: `@` popover keyboard flow, ＋ button, tags (add, remove, limit), `/` switcher; chips on the message bubble.
- **E2E:** extend `scripts/demo_acceptance.py` with the agent + reference steps; run twice on a clean stack.

## Out of scope
- Document text extraction / RAG (plan §25).
- Per-role or per-project agent visibility.
- Agent usage analytics UI (data recorded only).
- Agent versions or history, ratings, folders.
- File upload in the chat box.
