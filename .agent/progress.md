# Progress Tracker

Update this file at the end of every phase (status, date, notes, deviations).
Status values: `pending` · `in-progress` · `blocked` · `done`

| #  | Phase                       | Workflow                              | Est.     | Status  | Completed | Notes |
| -- | --------------------------- | ------------------------------------- | -------- | ------- | --------- | ----- |
| 01 | Project Foundation          | workflows/01-foundation.md            | 2–3 d    | done    | 2026-09-23 | Stack runs via docker compose; health 200 (backend + DB ok); baseline migration applied |
| 02 | Authentication              | workflows/02-authentication.md        | 2–3 d    | done    | 2026-09-23 | JWT access + rotating httpOnly refresh cookie, forced password change, rate limit, audit; 26 BE + 17 FE tests; verified E2E via nginx |
| 03 | Users & Permissions         | workflows/03-users-permissions.md     | 3–4 d    | done    | 2026-09-23 | User admin (create w/ temp password, edit, role, reset, enable/disable), guardrails, route-auth audit test; 73 BE + 25 FE tests; verified E2E via nginx |
| 04 | Projects                    | workflows/04-projects.md              | 2–3 d    | done    | 2026-09-23 | Projects + membership, visibility in SQL (404 for non-members), lead/admin rules, soft delete, demo seed; 92 BE + 31 FE tests; verified E2E with demo accounts |
| 05 | Documents                   | workflows/05-documents.md             | 4–5 d    | done    | 2026-09-23 | Upload (type+content+size validated before storage), download/view, edit, delete, search/filters, per-project codes, Documents tab via slot, demo files; 129 BE + 39 FE tests; verified E2E via nginx |
| 06 | Chat Backend                | workflows/06-chat-backend.md          | 3–4 d    | done    | 2026-09-23 | Conversations/messages, owner-only, project-scoped visibility, placeholder responder behind `ChatResponder`, error+retry, Arabic-safe titles, demo chats; 154 BE + 39 FE tests; verified E2E via nginx |
| 07 | OpenRouter Integration      | workflows/07-openrouter.md            | 2–3 d    | done    | 2026-09-23 | Admin-entered OpenRouter connection (encrypted key), model allow-list, guardrailed prompts, SSE streaming + fallback, usage/audit per request; 190 BE + 43 FE tests; live-verified against OpenRouter (invalid-key paths, catalog); a successful live answer needs a real key |
| 08 | Chat UI                     | workflows/08-chat-ui.md               | 3–4 d    | done    | 2026-09-28 | Two-pane chat (history grouped by date, search, rename/delete), SSE streaming with Stop, error + Retry, model picker, markdown + code highlight, `dir="auto"` Arabic, D2 warning, not-configured state; 190 BE + 52 FE tests; stream verified E2E via nginx (visual browser check pending: extension not connected) |
| 09 | Dashboard, Settings, Polish | workflows/09-dashboard-polish.md      | 2–3 d    | done    | 2026-09-28 | Scoped dashboard (hero, stats, recent work, admin AI-usage table), profile page, admin upload limits (DB overrides env), audit log API + UI, header search (Ctrl+K), responsive shell (icon rail / mobile drawer), in-shell 404 (B1), AI-failure toast; 204 BE + 61 FE tests; dashboard counts cross-checked against SQL and upload override verified E2E via nginx (visual browser check pending: extension not connected) |
| 10 | Testing & Demo Readiness    | workflows/10-testing.md               | 3–5 d    | done    | 2026-09-28 | Role × endpoint matrix (117 cases) and exactly-one-audit-row matrix; `scripts/demo_acceptance.py` passed twice in a row on a clean `docker compose -p egsa-e2e` stack (auto migrate + seed); frontend build has no secrets or runtime external hosts; `pnpm audit` and `pip-audit` clean; mypy clean; 321 BE + 61 FE tests. Not done: Playwright browser E2E, live AI answer (needs a real key) |
| 11 | Unified Sidebar (Claude-style) | workflows/11-sidebar-redesign.md | 1–2 d    | done    | 2026-09-28 | One sidebar (New chat, Search, pages, Administration, Recents grouped by date, account menu with About); no desktop header or tagline; chat page single-column with title menu; new /chats page; icon-rail collapse remembered; mobile drawer includes Recents; 75 FE tests; checked in the browser at 1440px (expanded, rail, account menu) and 400px (drawer) |
| 12 | Agents & Chat References   | workflows/12-agents-and-references.md | 5–7 d    | pending |           | Decisions in the workflow (D19) |

## Decision / deviation log

Record anything that differs from `.agent/*` or `plan.md` here.

| Date | Phase | Decision | Reason |
| ---- | ----- | -------- | ------ |
| 2026-09-23 | all | Frontend uses a feature-scoped structure instead of plan §32 | Scale by adding features as folders (ADR-01) |
| 2026-09-23 | all | Confirmed D1–D16 (see `context/decisions.md`): internal-network hosting, chat warning banner, English UI + Arabic chat, local accounts, SSE streaming from the start, shadcn/ui, status as label, local git + pre-commit (no CI), temp password + forced change, all roles chat, usage tracking without quotas, fake demo seed, uv + pnpm, unique doc code per project, 15 min / 8 h session, soft-delete for projects and conversations | Decisions agreed in chat before implementation |
| 2026-09-23 | 07 | Streaming moved from optional to required | D5 |
| 2026-09-23 | 01 | Tailwind **v4**: tokens live in `src/styles/tokens.css` + `@theme` in `globals.css`; there is no `tailwind.config.ts` | v4 is CSS-first; shadcn targets v4 |
| 2026-09-23 | 01 | Vite template now ships oxlint; replaced with **ESLint** + `eslint-plugin-boundaries` v7 (`boundaries/dependencies` policies) | Boundaries enforcement needs ESLint (ADR-01) |
| 2026-09-23 | 01 | Toaster pinned to light theme; `next-themes` removed | UI is light-only (design §2) |
| 2026-09-23 | 01 | This dev machine has Avast HTTPS scanning: uv needs `UV_SYSTEM_CERTS=1`, and Docker builds need the Avast CA in `backend/certs` and `frontend/certs` (git-ignored) | TLS inspection breaks package downloads |
| 2026-09-23 | 02 | Refresh tokens are opaque random strings (SHA-256 stored), not JWTs; rotation with reuse detection (a rotated token replayed after a 10 s grace window revokes all the user's sessions) | Revocable server-side; grace window + Web Locks avoid false alarms from multiple tabs |
| 2026-09-23 | 02 | Passwords are SHA-256 pre-hashed before bcrypt | bcrypt ignores bytes after 72; Arabic passphrases exceed that quickly |
| 2026-09-23 | 02 | `FeatureManifest.fullscreenRoutes` added (authenticated routes without the AppShell, e.g. /change-password) | Needed for the forced password change screen |
| 2026-09-23 | 03 | Users page + nav gated by `users:create` (not `users:read` as the workflow said) | Engineers/leads hold users:read for phase 04 member pickers but must not see user admin |
| 2026-09-23 | 03 | Routes declare `handle: { permission }`; `app/router.tsx` wraps them in RequirePermission | Features stay free of `app/` imports |
| 2026-09-23 | 03 | Route-auth test reads the OpenAPI schema instead of `app.routes` | FastAPI 0.141 wraps included routers in a private `_IncludedRouter`; OpenAPI is the stable public view |
| 2026-09-23 | 03 | One global role per user in the UI/API (`PUT /users/{id}/role`), though `user_roles` allows many | Matches plan's "Change role"; table stays future-proof |
| 2026-09-23 | 04 | Project detail returns `abilities` (can_edit / can_manage_members / can_delete) computed server-side | UI never re-implements lead/admin rules |
| 2026-09-23 | 04 | A project must always keep ≥1 lead (`LAST_PROJECT_LEAD`); the creator becomes lead | Every project stays manageable |
| 2026-09-23 | 04 | Project codes stay reserved after soft delete (unique across deleted rows) | Keeps audit trail unambiguous (D16) |
| 2026-09-23 | 04 | Demo users share `SEED_DEMO_PASSWORD`; demo seed refuses to run in production | D12 without shipping fake accounts to prod |
| 2026-09-23 | 04 | Documents/Activity tabs on project detail deferred to phases 05/09 | Avoid placeholder tabs with no content |
| 2026-09-23 | 05 | Categories at `/documents/categories` (not `/document-categories`) + `/documents/upload-config` | Keeps the documents API under one prefix; client pre-validation uses server limits |
| 2026-09-23 | 05 | Uploads are validated on a spooled temp copy (extension + magic bytes/zip structure/UTF-8 + size) BEFORE `StorageService.save` | Storage never holds rejected files; future MinIO gets the same guarantee |
| 2026-09-23 | 05 | Document abilities (`can_edit`/`can_delete`) computed server-side; uploader may edit/delete own docs while still a project contributor; leads manage all in their project | Same pattern as project abilities (phase 04) |
| 2026-09-23 | 05 | Frontend **extension slots** (`shared/lib/slots.ts`): documents contributes the project Documents tab without projects importing documents | Avoids a projects↔documents feature cycle (ADR-01) |
| 2026-09-23 | 05 | View/download fetch the file as a blob with the bearer token (`httpBlob`); uploads use XHR (`httpUpload`) for progress | Plain links can't carry the in-memory token (ADR-03); fetch has no upload progress |
| 2026-09-23 | 05 | `BCRYPT_ROUNDS` setting (default 12); tests use 4 | Backend suite 2m43s → 18s, production cost unchanged |
| 2026-09-23 | 06 | AI access goes through a `ChatResponder` protocol; phase 06 ships an honest `PlaceholderResponder`, phase 07 swaps in OpenRouter | Chat history works with no AI (plan §40); tests use a scripted responder |
| 2026-09-23 | 06 | Messages carry an explicit `position` (unique per conversation) | Timestamps can collide; transcript order must be exact |
| 2026-09-23 | 06 | User message is committed BEFORE the AI call; AI failures are saved as `status=error` assistant messages (201), retried in place via `POST /conversations/{id}/retry` | Never lose what the user typed; Retry reuses the same transcript slot |
| 2026-09-23 | 06 | Project-linked conversations are listed only while the owner can still access the project | Covers project soft delete (D16) and removal from a project |
| 2026-09-23 | 06 | Failed replies are excluded from the history sent to the model | Error text must not pollute AI context |
| 2026-09-23 | 07 | **D17**: OpenRouter connection entered in Admin Settings (encrypted in DB), not env vars; `.env` OpenRouter vars removed | User request; keeps setup in the UI, key still server-only |
| 2026-09-23 | 07 | Guardrails always appended to the admin's system prompt (no claimed access to EgSA documents; reply in the user's language) | Plan §24/§25 + D3 can't be edited away |
| 2026-09-23 | 07 | "Test connection" validates the key via OpenRouter `/key`; `/models` is public and can't prove a key works | Found live: listing models succeeded with an invalid key |
| 2026-09-23 | 07 | httpx uses the OS trust store (`ssl.create_default_context()`) | TLS-inspecting proxies/AV (D1) broke certifi-only verification |
| 2026-09-23 | 07 | Streaming: user msg + empty assistant row saved before the stream; the SSE generator uses its own DB session and always persists the final state (client disconnect → partial text + `STREAM_ABORTED`) | Request-scoped session ends before the stream; transcript must stay truthful |
| 2026-09-23 | 07 | Model chosen per message must be in the admin allow-list (400 `MODEL_NOT_ALLOWED`, nothing saved) | Plan §20 |
| 2026-09-28 | 08 | Streaming state lives in the React Query message cache (`useChatStream`): start/delta/done update it, Stop aborts then re-syncs with the server copy | One source of truth; no duplicated local transcript |
| 2026-09-28 | 08 | If the stream can't be opened (network/5xx), the UI falls back to the non-streaming endpoint; 4xx errors are shown as-is | Proxies that break SSE still get answers; validation errors must not double-send |
| 2026-09-28 | 08 | A new chat is created only when its first message is sent | No empty conversations in history |
| 2026-09-28 | 08 | `readSSE` decodes with `TextDecoder({stream})` instead of `TextDecoderStream` | Keeps Arabic multi-byte chars intact across chunks; works in jsdom and TS 6 typings |
| 2026-09-28 | 09 | Upload limits live in a single-row `app_settings` table; NULL = environment default, "Reset" clears the override | Admins can change limits without a redeploy; env stays the fallback |
| 2026-09-28 | 09 | Dashboard reuses each feature's list service (page size 5) for recent items and counts | Same visibility rules as the list pages, no duplicated scoping SQL |
| 2026-09-28 | 09 | Admin block gated by `settings:manage`; AI usage is a 7-day per-user table (requests, failed, tokens) | D11: tracked, no limits |
| 2026-09-28 | 09 | Header search hands text to list pages via `?q=` (documents default, projects second), filtered by permission | POC scope: no unified search index |
| 2026-09-28 | 09 | Profile edits are self-service for name and job title only; email and role stay admin-managed | Identity fields are access-relevant |
| 2026-09-28 | 09 | The dashboard hero art is an inline SVG | D1: no external images or CDNs |
| 2026-09-28 | 10 | Demo acceptance is an API-level script (stdlib Python) instead of Playwright | No browser download on the internal network; UI-only steps (toasts, RTL) are covered by Vitest |
| 2026-09-28 | 10 | Clean-install check runs as a separate compose project (`-p egsa-e2e`, port 8088) | Tests a fresh DB + seed without touching the working stack's data |
| 2026-09-28 | UI | Adopted `rules/ui-principles.md` below the EgSA brand rules: borders over shadows, radius 6/8/10/14, page H1 24px/600, reduced motion, "is my data safe" error copy | User review of a generic enterprise UI guide; its branding, on-prem privacy claims and RAG-only features were excluded |
| 2026-09-28 | UI | Kept the dashboard hero (gradient + Earth art) and the model name on AI answers; dark mode deferred (B5) | User decisions |
| 2026-09-28 | UI | Full-page tables fit the window: rows per page are measured from the space left (`useFitRows`), the card always reaches the page bottom with the pager pinned; phones/short windows and embedded tables keep normal paging | User decision (fit rows, full-page lists only, card to bottom, normal scrolling on small screens) |
| 2026-09-28 | UI | Chat messages: user on the right; hover actions (user: Copy, Edit; AI: Copy, Retry, response time, "Model: <name>"). Backend: retry now also regenerates a completed latest answer; new `PUT /conversations/{id}/messages/{message_id}` edits the latest user message and regenerates its answer in place | User request; editing/retrying only the latest turn avoids history branches in the POC |
| 2026-09-23 | 01 | Health endpoint returns 503 `{status: degraded}` when the DB is down (instead of 200) | Lets Docker/monitoring detect DB loss |
