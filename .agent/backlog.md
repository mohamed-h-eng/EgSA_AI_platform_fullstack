# Backlog: known issues to fix later

Found during implementation and deliberately deferred. When you fix one, move it to **Done** with the date and commit.

| #  | Found in | Area     | Issue | Impact | Suggested fix |
| -- | -------- | -------- | ----- | ------ | ------------- |
| B1 | Phase 03 | Frontend | Unknown URLs render the full-page `RouteError` **without the AppShell**, and signed-out users see "Page not found" instead of being redirected to `/login`. The `*` route's loader throws before `RequireAuth` runs, and the root `errorElement` replaces the whole shell. | Cosmetic / UX | Render a `NotFound` element inside the authenticated shell for `*` (no throwing loader); keep `errorElement` for real errors only. |
| B2 | Phase 03 | Backend  | Expired and revoked `refresh_tokens` rows are never deleted, so the table grows by about one row per login or refresh. | Slow DB growth | Periodic cleanup: delete rows with `expires_at < now() - 1 day`, run on startup or as a small scheduled job. Keep recently revoked rows for the reuse-detection window. |
| B3 | Phase 02 | Backend  | The login rate limiter is **in-memory**: it resets on restart, isn't shared across processes, and never prunes idle keys. | Acceptable for the single-process POC | Move to Postgres or Redis if the backend ever runs more than one worker; prune empty keys when checking. |
| B4 | Phase 01 | Tests    | Pytest shows one third-party warning: Starlette's `TestClient` recommends `httpx2` instead of `httpx`. | None (warning only) | Revisit when upgrading FastAPI/Starlette; no action needed now. |

## Done

| # | Fixed on | Commit | Notes |
| - | -------- | ------ | ----- |
