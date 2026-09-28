# Backend Architecture: FastAPI

Follows `plan.md` §31, with conventions added so each domain can grow independently.

## Folder structure

```text
backend/
├── app/
│   ├── main.py                 ← create_app(): routers, CORS, exception handlers, lifespan
│   ├── core/
│   │   ├── config.py           ← pydantic-settings (reads .env)
│   │   ├── security.py         ← password hashing, JWT encode/decode
│   │   ├── errors.py           ← AppError hierarchy → consistent JSON error responses
│   │   └── logging.py
│   ├── database/
│   │   ├── base.py             ← DeclarativeBase, UUID/timestamp mixins
│   │   ├── session.py          ← engine, SessionLocal, get_db dependency
│   │   └── seed.py             ← roles, permissions, admin user, AI defaults
│   ├── api/
│   │   ├── deps.py             ← get_current_user, require_permission(), require_project_access()
│   │   └── v1/
│   │       ├── router.py       ← includes all domain routers under /api/v1
│   │       ├── auth.py
│   │       ├── users.py
│   │       ├── roles.py
│   │       ├── projects.py
│   │       ├── documents.py
│   │       ├── conversations.py
│   │       ├── ai.py           ← GET /ai/models
│   │       ├── dashboard.py
│   │       └── admin.py        ← /admin/ai/config, /admin/settings, /admin/audit-logs
│   ├── models/                 ← SQLAlchemy ORM (one file per aggregate)
│   │   ├── user.py  role.py  permission.py  project.py  document.py
│   │   ├── conversation.py  message.py  audit.py  ai_settings.py  ai_usage.py
│   ├── schemas/                ← Pydantic request/response DTOs, one file per domain
│   ├── services/               ← business logic; routers stay thin
│   │   ├── auth/  users/  projects/  documents/  chat/  audit/  dashboard/
│   │   └── ai/
│   │       ├── base.py         ← AIProvider protocol: list_models(), complete(), stream()
│   │       └── openrouter.py   ← OpenRouterProvider
│   ├── permissions/
│   │   ├── codes.py            ← permission code constants
│   │   ├── matrix.py           ← default role → permissions mapping (used by seed)
│   │   └── policies.py         ← can_access_project(), visible_project_ids(), etc.
│   └── storage/
│       ├── base.py             ← StorageService protocol: upload(), download(), delete()
│       └── local.py            ← LocalStorage (STORAGE_ROOT/documents/<uuid>)
├── alembic/  + alembic.ini
├── tests/                      ← mirrors app/ domains; conftest with test DB + factories
├── pyproject.toml + uv.lock
└── Dockerfile
```

## Layering rules

```text
api (router)  →  services  →  models / storage / ai provider
     │               │
  schemas         permissions/policies
```

- **Routers:** parse input, inject deps (`current_user`, `db`), call one service, return a schema. No SQL or business rules here.
- **Services:** hold business rules, permission checks on data, and audit calls. Receive `db` and `actor`.
- **Models** never import services. **Schemas** never import models (use `from_attributes`).
- External systems (filesystem, OpenRouter) are only reached through `storage/` and `services/ai/` interfaces.

## Conventions

- Every endpoint is under `/api/v1`, and every endpoint except `/auth/login`, `/auth/refresh`, and `/health` requires auth.
- List endpoints return `{ items, total, page, page_size }` and accept `page`, `page_size`, `q`, and filters.
- Errors return `{ "error": { "code": "DOCUMENT_NOT_FOUND", "message": "...", "details": {} } }`.
- Return **404 rather than 403** when a resource exists in a project the user can't access, so project existence isn't leaked.
- Timestamps are UTC (`created_at`, `updated_at`).
- **Deletion (D16):** users are soft-disabled (`is_active`). **Projects and conversations are soft-deleted** (`deleted_at`) and filtered out of every query through a shared `not_deleted()` helper or mixin. **Documents are hard-deleted** along with their stored file.
- **Uniqueness:** `UNIQUE(project_id, code)` on documents (D14), `UNIQUE(code)` on projects, and `UNIQUE(lower(email))` on users.
- **Text:** the DB is UTF-8. Search uses `ILIKE` on Unicode text. Any truncation (titles, previews) is done on characters, never bytes, so Arabic is safe (D3).
- **Tooling:** `uv` manages dependencies (`pyproject.toml` + `uv.lock`). The Dockerfile uses `uv sync --frozen`.
- Every schema change goes through an Alembic migration. Never use `create_all` outside tests.
- Secrets come only from env vars. `.env.example` is committed and `.env` is not.
- Audit (`services/audit.log(...)`) is called on: login, logout, user create, role change, permission/membership change, project create, document upload/download/delete, AI request, profile update, settings changes. Every `AuditAction` must be emitted somewhere; `tests/test_phase09.py::test_every_audit_action_is_emitted_somewhere` enforces it.

## Database tables (plan §33, plus supporting tables)

```text
users · roles · permissions · role_permissions · user_roles
projects · project_members(project_id, user_id, project_role)
documents · document_categories · (document_permissions: create table, unused in POC)
conversations · messages
audit_logs · ai_settings · ai_usage · refresh_tokens (or token_version on users)
```

Do not create RAG tables (chunks, embeddings, indexes).
