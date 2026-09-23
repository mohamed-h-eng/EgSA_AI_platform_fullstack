# Stack & Architectural Decisions

Items marked **(plan)** come from `plan.md`. Items marked **(default)** fill gaps the plan left open. Change them here, and add a row to the log in `progress.md`, before building on a different choice.

## Stack

| Concern              | Choice                                                      | Source    |
| -------------------- | ----------------------------------------------------------- | --------- |
| Frontend             | React + TypeScript, **Vite**                                | plan / default |
| Styling              | Tailwind CSS with design tokens from `design.md` §43        | plan      |
| Routing              | React Router (data routers, lazy routes per feature)        | default   |
| Server state         | TanStack Query                                              | default   |
| Client state         | React context (auth session); Zustand only if needed        | default   |
| Forms / validation   | react-hook-form + zod                                       | default   |
| UI components        | **shadcn/ui** (Radix primitives) restyled with EgSA tokens, code owned in `shared/ui` | confirmed |
| Icons                | lucide-react (single icon family, design §19)              | default   |
| Font                 | Inter (UI) + IBM Plex Sans Arabic / Noto Sans Arabic fallback (chat), **self-hosted** | design / confirmed |
| Package managers     | **uv** (Python), **pnpm** (Node), lockfiles committed       | confirmed |
| Markdown in chat     | react-markdown (no raw HTML) + code highlighting            | default   |
| Backend              | Python 3.12 + FastAPI                                       | plan      |
| ORM / migrations     | SQLAlchemy 2.x + **Alembic**                                | plan / default |
| Validation           | Pydantic v2 + pydantic-settings                             | plan      |
| Auth                 | JWT access + refresh tokens (PyJWT), bcrypt password hash   | plan      |
| HTTP client (AI)     | httpx (async, streaming)                                    | default   |
| Database             | PostgreSQL 16                                               | plan      |
| File storage         | Local filesystem behind `StorageService`                    | plan      |
| AI                   | OpenRouter, free models, configurable via env + DB          | plan      |
| API style            | REST, JSON; SSE for streaming chat                          | plan      |
| Tests                | pytest + httpx TestClient (BE); Vitest + RTL (FE); Playwright optional for E2E | default |
| Lint / format        | ruff + mypy (BE); ESLint + Prettier + tsc (FE)              | default   |
| Version control / CI | Local git + **pre-commit hooks**; **no CI** in the POC       | confirmed |
| Deployment           | Docker Compose: `db`, `backend`, `frontend`, `nginx`        | plan      |

## Architectural decisions

- **ADR-01: Frontend is feature-scoped.** See `rules/frontend-architecture.md`. Replaces plan §32.
- **ADR-02: Backend keeps the plan §31 layout** (api / models / schemas / services / permissions / storage / database). Each domain maps 1:1 to a frontend feature so both sides scale together.
- **ADR-03: Token storage.** Short-lived access token (**15 min**) kept in memory; refresh token (**8 h**, one workday) in an **httpOnly, SameSite=Strict cookie** set by the backend. `POST /auth/refresh` issues new access tokens. (Keeps tokens out of `localStorage`.)
- **ADR-04: Permissions are enforced on the backend.** The frontend only hides UI, using the `permissions` array returned by `/auth/me`.
- **ADR-05: Permission codes are strings** such as `documents:upload`. Roles map to permission sets through the `role_permissions` table, so a new role only needs new rows, not code.
- **ADR-06: Project access** = global role permission **AND** project membership (Admin bypasses membership).
- **ADR-07: AI behind an `AIProvider` interface**; `OpenRouterProvider` is the only implementation. Chat service depends on the interface.
- **ADR-08: Storage behind `StorageService`**; `LocalStorage` is the only implementation. Files are stored by UUID key, never by user filename.
- **ADR-09: Audit is write-only in the POC.** An `audit.log(actor, action, target, meta)` call is made from services. The only UI is a simple admin table (optional).
- **ADR-10: API prefix `/api/v1`.** Nginx serves the SPA at `/` and proxies `/api` to the backend.
- **ADR-11: IDs are UUIDs.** Human document codes (e.g. `EPS-SRS-001`) are a separate `code` field.

## Confirmed product decisions (2026-09-23)

| #  | Topic          | Decision |
| -- | -------------- | -------- |
| D1 | Hosting        | Runs locally / on the **EgSA internal network only**. The only outbound internet connection is **backend → openrouter.ai**. Browsers load nothing from public CDNs, so fonts, icons, and images are bundled. Docker images and pnpm/uv packages are fetched at build time (a machine with internet access, or an internal mirror). |
| D2 | AI data policy | A **permanent warning banner** in chat: "Do not enter classified or sensitive project data. Messages are sent to an external AI provider." Chat is otherwise unrestricted, and project metadata context (plan §24) is kept. |
| D3 | Language       | **UI in English only.** Chat messages (user and AI) **may be Arabic**. Each message uses `dir="auto"`, the chat has an Arabic-capable fallback font, and truncation, search, and titles must handle Arabic text safely. No i18n framework in the POC. |
| D4 | Identity       | **Local accounts only.** AD/LDAP/SSO come later through the auth-provider seam. |
| D5 | Streaming      | **SSE streaming from the start** (phase 07 main path). A non-streaming endpoint stays as a fallback. |
| D6 | UI kit         | **shadcn/ui + Tailwind**, restyled to `design.md`. |
| D7 | Document status | **Metadata label only** (Draft / Pending Review / Approved / Obsolete), editable by anyone with edit rights on the document. No approval workflow. |
| D8 | Git / CI       | **Local git only**, with pre-commit hooks (ruff, prettier, eslint). No CI pipeline yet. |
| D9 | Passwords      | The admin sets a **temporary password** and the user is **forced to change it at first login**. The admin can reset a password, which sets a new temp password and forces another change. No email. |
| D10 | Chat access   | **All roles** (including Viewer) have `chat:use`. |
| D11 | AI quotas     | **Track usage per user (requests and tokens), no limits.** Handle 429 from OpenRouter gracefully. Usage appears on the admin dashboard. |
| D12 | Seed data     | A **realistic fake demo seed** is required: NEXSAT-1, EgyptSat-2, SAR, users per role, placeholder PDF/DOCX/TXT files, and sample conversations. It must be reproducible and contain no real data. Enabled with `SEED_DEMO=true`. |
| D13 | Package managers | **uv + pnpm.** |
| D14 | Document codes | **Unique per project** (`UNIQUE(project_id, code)`). A duplicate upload is rejected with `DOCUMENT_CODE_EXISTS`. No revisions in the POC. |
| D15 | Session       | **15 min access / 8 h refresh.** |
| D16 | Deletion      | **Soft-delete conversations and projects** (`deleted_at`, hidden everywhere, admin can recover through the DB). **Documents are hard-deleted** along with their file. The audit log keeps every deletion. |

### Still open (non-blocking)
- Default free OpenRouter model: pick it just before the demo (the free lineup changes).
- Backup and retention for Postgres and the file store.
- Whether the audit log gets a UI (phase 09, optional).
