# Progress Tracker

Update this file at the end of every phase (status, date, notes, deviations).
Status values: `pending` · `in-progress` · `blocked` · `done`

| #  | Phase                       | Workflow                              | Est.     | Status  | Completed | Notes |
| -- | --------------------------- | ------------------------------------- | -------- | ------- | --------- | ----- |
| 01 | Project Foundation          | workflows/01-foundation.md            | 2–3 d    | done    | 2026-09-23 | Stack runs via docker compose; health 200 (backend + DB ok); baseline migration applied |
| 02 | Authentication              | workflows/02-authentication.md        | 2–3 d    | done    | 2026-09-23 | JWT access + rotating httpOnly refresh cookie, forced password change, rate limit, audit; 26 BE + 17 FE tests; verified E2E via nginx |
| 03 | Users & Permissions         | workflows/03-users-permissions.md     | 3–4 d    | pending |           |       |
| 04 | Projects                    | workflows/04-projects.md              | 2–3 d    | pending |           |       |
| 05 | Documents                   | workflows/05-documents.md             | 4–5 d    | pending |           |       |
| 06 | Chat Backend                | workflows/06-chat-backend.md          | 3–4 d    | pending |           |       |
| 07 | OpenRouter Integration      | workflows/07-openrouter.md            | 2–3 d    | pending |           |       |
| 08 | Chat UI                     | workflows/08-chat-ui.md               | 3–4 d    | pending |           |       |
| 09 | Dashboard, Settings, Polish | workflows/09-dashboard-polish.md      | 2–3 d    | pending |           |       |
| 10 | Testing & Demo Readiness    | workflows/10-testing.md               | 3–5 d    | pending |           |       |

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
| 2026-09-23 | 01 | Health endpoint returns 503 `{status: degraded}` when the DB is down (instead of 200) | Lets Docker/monitoring detect DB loss |
