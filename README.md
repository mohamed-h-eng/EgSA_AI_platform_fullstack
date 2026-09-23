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

On start, the backend runs `alembic upgrade head`. The dashboard shows live **Backend API** and
**Database** status. The API docs are at `http://localhost/api/v1/docs`.

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
