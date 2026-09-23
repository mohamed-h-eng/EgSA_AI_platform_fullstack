# Phase 01: Project Foundation (2–3 days)

**Goal:** Frontend ↔ Backend ↔ Database are connected and running with one command, and the skeletons follow the `.agent/rules` structures.

## Prerequisites
None.

## Steps

### 1. Repository
- [ ] `git init`, `.gitignore` (node_modules, .venv, `.env`, `storage/`, `__pycache__`, dist)
- [ ] Monorepo root layout:
  ```text
  fullstack/
  ├── .agent/            (this folder)
  ├── backend/
  ├── frontend/
  ├── nginx/nginx.conf
  ├── docker-compose.yml
  ├── .env.example
  ├── plan.md  design.md
  └── README.md          (how to run)
  ```
- [ ] `.editorconfig` plus **pre-commit hooks** (required, D8): ruff (lint and format), prettier, eslint, and a secret scan such as `detect-secrets` or gitleaks. **No CI pipeline** in the POC.
- [ ] README section **"Building on the internal network" (D1):** Docker images and pnpm/uv packages must be fetched on a machine with internet access or through an internal mirror. At runtime, only the backend needs outbound HTTPS to `openrouter.ai`.

### 2. Environment variables (`.env.example`)
```env
# Database
POSTGRES_USER=egsa
POSTGRES_PASSWORD=change-me
POSTGRES_DB=egsa_ai
DATABASE_URL=postgresql+psycopg://egsa:change-me@db:5432/egsa_ai
# Auth
JWT_SECRET=change-me
ACCESS_TOKEN_TTL_MIN=15
REFRESH_TOKEN_TTL_HOURS=8
# Storage
STORAGE_ROOT=/data/storage
MAX_UPLOAD_MB=50
ALLOWED_FILE_TYPES=pdf,docx,txt
# AI (backend only)
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
DEFAULT_AI_MODEL=
# Seed
SEED_ADMIN_EMAIL=admin@egsa.local
SEED_ADMIN_PASSWORD=change-me
SEED_DEMO=true          # realistic fake demo data (D12)
# Frontend
VITE_API_BASE_URL=/api/v1
CORS_ORIGINS=http://localhost:5173
```

### 3. Backend skeleton (see `rules/backend-architecture.md`)
- [ ] `uv init` a Python 3.12 project (`pyproject.toml` + `uv.lock`, D13) with FastAPI, uvicorn, SQLAlchemy 2, psycopg, alembic, pydantic-settings, PyJWT, bcrypt, httpx, python-multipart, and dev tools (pytest, ruff, mypy).
- [ ] Create every folder from the backend rule, with an empty `__init__.py` in each.
- [ ] `core/config.py` (Settings), `database/session.py`, `database/base.py` (UUID PK and timestamp mixins).
- [ ] `core/errors.py` with the global exception handler and the standard error shape.
- [ ] `main.py`: create_app, CORS, `/api/v1` router, and `GET /api/v1/health` (checks DB with `SELECT 1`).
- [ ] Initialize Alembic. The first migration is empty or holds the base tables.
- [ ] `Dockerfile` (slim, non-root, `uv sync --frozen`, uvicorn).
- [ ] One test: `test_health.py`.

### 4. Frontend skeleton (see `rules/frontend-architecture.md`)
- [ ] `pnpm create vite frontend --template react-ts` (pnpm, D13)
- [ ] Install react-router-dom, @tanstack/react-query, react-hook-form, zod, @hookform/resolvers, lucide-react, clsx, and tailwind. Dev: vitest, @testing-library/react, eslint-plugin-boundaries (or import rules), prettier.
- [ ] **shadcn/ui (D6):** `pnpm dlx shadcn@latest init` with `components.json` aliases pointing to `@shared/ui` and `@shared/lib/utils`. Map the shadcn CSS variables to the EgSA tokens. Add the base set: button, input, dialog, sheet (drawer), dropdown-menu, select, tabs, table, badge, avatar, tooltip, sonner (toasts), skeleton.
- [ ] **Self-hosted fonts (D1, D3):** `@fontsource-variable/inter` + `@fontsource/ibm-plex-sans-arabic` (or Noto Sans Arabic). Confirm no request goes to fonts.googleapis.com or any other CDN.
- [ ] Path aliases `@app`, `@features`, `@shared` in tsconfig and vite.
- [ ] Create `app/`, `features/`, `shared/`, and `styles/` exactly as in the rule.
- [ ] `styles/tokens.css` and `tailwind.config.ts` hold the design tokens (`rules/design-system.md`). Load the Inter font.
- [ ] `shared/types/feature.ts` (FeatureManifest), `app/feature-registry.ts`, and `app/router.tsx` generate routes and nav from manifests.
- [ ] `shared/api/http.ts`: base URL from `VITE_API_BASE_URL`, JSON handling, typed `ApiError`. Leave hooks for adding the auth header and refresh logic in phase 02.
- [ ] `shared/layout/AppShell`, `Sidebar` (EgSA logo placeholder, nav from registry), `Header` (product name), and `PageHeader`.
- [ ] Temporary `features/dashboard` with a manifest and a page that calls `/health` and shows "Backend: OK / DB: OK".
- [ ] ESLint boundary rules enforced (a feature importing another feature's internals fails lint).
- [ ] `Dockerfile`: multi-stage build that produces static assets served by Nginx.

### 5. Docker & Nginx
- [ ] `docker-compose.yml` services: `db` (postgres:16, volume, healthcheck), `backend` (depends_on db healthy, runs `alembic upgrade head` on start, mounts the storage volume), `frontend`/`nginx` (serves the SPA and proxies `/api` → backend:8000).
- [ ] Local dev path without Docker: `uvicorn --reload` plus `vite` with a proxy for `/api`.

## Verification
- `docker compose up --build` opens the dashboard stub at `http://localhost`, and it shows backend and DB as healthy.
- `pytest`, `ruff`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass, and `pre-commit run --all-files` passes.
- The browser network tab shows no requests to external hosts.
- A deliberate cross-feature internal import is rejected by lint.

## Deliverable
`Frontend ↔ Backend ↔ Database` working. Empty feature-scoped skeleton ready.

## Out of scope
Auth, real pages, any AI.
