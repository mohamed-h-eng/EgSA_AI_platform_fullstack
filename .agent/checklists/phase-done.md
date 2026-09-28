# Definition of Done (any phase or feature)

## Scope
- [ ] Every checkbox in the phase workflow is done, or explicitly deferred with a reason logged in `progress.md`.
- [ ] Nothing from the exclusion list (`context/objectives.md`) was built.

## Backend
- [ ] Models have Alembic migrations, and `alembic upgrade head` works on a fresh DB.
- [ ] Routers are thin, logic sits in services, and external I/O goes through the interfaces (`StorageService`, `AIProvider`).
- [ ] Every new endpoint has auth and a permission dependency, and project-scoped data is filtered in SQL.
- [ ] Out-of-scope resources return 404. Errors use the standard error shape.
- [ ] Audit events are emitted for the actions listed in the rules.
- [ ] `pytest`, `ruff`, and `mypy` pass.

## Frontend
- [ ] Code lives in `src/features/<feature>/`, the public API goes through `index.ts`, and the manifest is registered.
- [ ] No cross-feature internal imports (boundary lint passes). `shared/` doesn't import from features.
- [ ] Every data view has loading, empty, and error states. Actions are permission-gated.
- [ ] Uses design tokens only (no hard-coded hex values), Lucide icons, and the PageHeader pattern.
- [ ] UI definition of done (`rules/ui-principles.md` §34, §38): hover, focus, disabled, loading, error and empty states exist; errors say whether the user's data is safe; borders instead of shadows on cards; keyboard works; no new visual pattern without a reason.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- [ ] No external runtime URLs (fonts and assets are self-hosted). User-generated text is rendered with `dir="auto"`.

## Security
- [ ] No secrets in the frontend or in git. `.env.example` is updated for new vars.
- [ ] Manually tried as a user without access: denied.

## Wrap-up
- [ ] `docker compose up --build` still works, and `pre-commit run --all-files` passes (it's the quality gate, since there's no CI).
- [ ] Nothing contradicts D1–D17 in `context/decisions.md`.
- [ ] `progress.md` is updated (status, date, notes).
