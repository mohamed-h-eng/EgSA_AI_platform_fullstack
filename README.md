# EgSA AI Engineering Platform (POC)

Internal platform for the Egyptian Space Agency: authentication, permissions, projects,
documents, and AI chat through OpenRouter. The POC scope is in [`plan.md`](plan.md), the UI rules
are in [`design.md`](design.md), and the build workflow is in [`.agent/`](.agent/README.md).

| Layer    | Stack                                                       |
| -------- | ----------------------------------------------------------- |
| Frontend | React 19 + TypeScript, Vite, Tailwind v4, shadcn/ui, TanStack Query, React Router |
| Backend  | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2    |
| Data     | PostgreSQL 16, local file storage                           |
| Runtime  | Docker Compose: `db`, `backend`, `web` (nginx: SPA + `/api` proxy) |

```text
fullstack/
├── .agent/          workflow, rules, decisions (read first)
├── backend/         FastAPI app (app/, alembic/, tests/)
├── frontend/        React app (src/app, src/features/<feature>, src/shared)
├── nginx/           nginx site config (mounted into the web container)
├── docker-compose.yml
└── .env.example     copy to .env
```

## Run with Docker (recommended)

```bash
cp .env.example .env        # then replace every "change-me" value
docker compose up --build   # http://localhost  (HTTP_PORT in .env)
```

On start, the backend runs `alembic upgrade head` and seeds roles, permissions and the first
admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, used only when that admin is first created).
`GET /api/v1/health` reports the backend and database status. The API docs are at
`http://localhost/api/v1/docs`.

Admins can also set the **upload limits** (max size, allowed types) in **Admin Settings → Uploads**;
they override `MAX_UPLOAD_MB` / `ALLOWED_FILE_TYPES` from `.env` until reset.

### Connecting the AI (OpenRouter)

The OpenRouter connection is configured **in the app**, not in `.env` (decision D17):

1. Sign in as an admin → **Admin Settings → AI model**.
2. Paste your OpenRouter API key (openrouter.ai → Keys) and click **Test connection**.
3. **Save**, then pick the allowed free models and the default one, and **Save** again.

The key is stored encrypted and is never shown again or sent to browsers. Only the backend
needs outbound HTTPS to `openrouter.ai`.

### Demo data (`SEED_DEMO=true`, decision D12)

Fake accounts and projects for demonstrations, all sharing `SEED_DEMO_PASSWORD`:

| Account                  | Global role  | Projects                              |
| ------------------------ | ------------ | ------------------------------------- |
| `ahmed.lead@egsa.local`  | Project Lead | NEXSAT-1 (lead), EGYPTSAT-2 (lead)    |
| `mohamed.eng@egsa.local` | Engineer     | NEXSAT-1                              |
| `sara.viewer@egsa.local` | Viewer       | NEXSAT-1 (read-only)                  |
| `hussein.sar@egsa.local` | Project Lead | SAR only (can't see the others)       |

The seed refuses to run with `ENVIRONMENT=production`.

## Run locally without Docker (development)

Prerequisites: [uv](https://docs.astral.sh/uv/), Node 22 + [pnpm](https://pnpm.io), and a PostgreSQL 16 instance.

```bash
# Backend: http://localhost:8000
cd backend
uv sync
# Set DATABASE_URL to your local Postgres (in ../.env or backend/.env), then:
uv run alembic upgrade head
uv run uvicorn app.main:app --reload

# Frontend: http://localhost:5173  (proxies /api to :8000)
cd frontend
pnpm install
pnpm dev
```

## Quality checks

There's no CI in the POC (decision D8). The **pre-commit hooks** are the quality gate:

```bash
uv tool install pre-commit
pre-commit install            # runs on every commit
pre-commit run --all-files    # run everything manually
```

| Area     | Commands                                                                 |
| -------- | ------------------------------------------------------------------------ |
| Backend  | `uv run pytest` · `uv run ruff check .` · `uv run ruff format .` · `uv run mypy app` |
| Frontend | `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm format` · `pnpm build` |

The backend suite includes a role × endpoint permission matrix (`tests/test_role_matrix.py`) and
an audit matrix that checks every audited action writes exactly one row (`tests/test_audit_rows.py`).

### Demo acceptance run

`scripts/demo_acceptance.py` runs the demo checklist (`.agent/checklists/demo-acceptance.md`)
against a running stack through the API. It uses fresh names on every run, so it can run twice in a
row. It needs the stack to be seeded from the same `.env` (admin and demo passwords):

```bash
python scripts/demo_acceptance.py --base-url http://localhost --env-file .env
```

To test a clean install without touching your data, start a separate stack first:
`HTTP_PORT=8088 docker compose -p egsa-e2e up -d --build`, run the script with
`--base-url http://localhost:8088`, then `docker compose -p egsa-e2e down -v`.
The script disables the user it creates (step 17), so use a throwaway stack when you can.

`pnpm lint` also enforces the **feature boundaries**: a feature may import another feature only
through its `index.ts`, and `src/shared` may never import features or `src/app`.

## Building on the internal network (decision D1)

- **Runtime:** browsers load nothing from the internet (fonts and assets are bundled). The backend
  is the only component that needs outbound HTTPS, and only to `openrouter.ai`.
- **Build time:** Docker images (`python`, `node`, `nginx`, `postgres`) and pnpm/uv packages are
  downloaded during `docker compose build`. Build on a machine with internet access, or point the
  package managers at an internal mirror.
- **TLS inspection (proxy or antivirus HTTPS scanning):** if downloads fail with
  `invalid peer certificate: UnknownIssuer`:
  - Local tools: set `UV_SYSTEM_CERTS=1` for uv. Node/pnpm use `NODE_EXTRA_CA_CERTS`.
  - Docker builds: copy the inspecting CA certificate (PEM) as `*.crt` into `backend/certs/` and
    `frontend/certs/`. These files are git-ignored.

## Known limitations (POC)

- **No document knowledge in chat yet.** The assistant answers general engineering questions; it
  can't read EgSA documents (no RAG). Its system prompt forbids claiming otherwise.
- **Search** is per list (documents, projects, conversation titles), using `ILIKE`; there's no
  full-text or cross-entity index. Header search (Ctrl+K) hands the text to those lists.
- **Single backend process.** The login rate limiter is in memory (backlog B3), and expired
  refresh tokens aren't cleaned up yet (B2).
- **Local file storage** only (`STORAGE_ROOT`); back up the `storage-data` volume with the database.
- **Chat on phones** hides the conversation list; open past chats from the dashboard.
- **Brand assets:** the sidebar uses a placeholder mark until the official EgSA logo is added at
  `frontend/src/shared/assets/egsa-logo.svg`.
- The live AI answer needs an OpenRouter key entered by an admin; without one, chat saves the
  question and shows a clear "not configured" message with Retry.
