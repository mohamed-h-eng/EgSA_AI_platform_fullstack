# Backlog: known issues to fix later

Found during implementation and deliberately deferred. When you fix one, move it to **Done** with the date and commit.

| #  | Found in | Area     | Issue | Impact | Suggested fix |
| -- | -------- | -------- | ----- | ------ | ------------- |
| B2 | Phase 03 | Backend  | Expired and revoked `refresh_tokens` rows are never deleted, so the table grows by about one row per login or refresh. | Slow DB growth | Periodic cleanup: delete rows with `expires_at < now() - 1 day`, run on startup or as a small scheduled job. Keep recently revoked rows for the reuse-detection window. |
| B3 | Phase 02 | Backend  | The login rate limiter is **in-memory**: it resets on restart, isn't shared across processes, and never prunes idle keys. | Acceptable for the single-process POC | Move to Postgres or Redis if the backend ever runs more than one worker; prune empty keys when checking. |
| B4 | Phase 01 | Tests    | Pytest shows one third-party warning: Starlette's `TestClient` recommends `httpx2` instead of `httpx`. | None (warning only) | Revisit when upgrading FastAPI/Starlette; no action needed now. |

## Done

| # | Fixed on | Commit | Notes |
| - | -------- | ------ | ----- |
| B1 | 2026-09-28 | (phase 09 commit) | `*` renders `NotFoundPage` inside the shell with no throwing loader; page errors use an in-shell `errorElement`, so signed-out users on unknown URLs are redirected to /login |
