# Recipe: Add a New Feature (scaling workflow)

Use this for anything new after the POC phases, or for a new domain added mid-POC (e.g. `notifications-center`, `knowledge`, `rag-search`, `model-management`).

## 0. Define
- [ ] Name it in kebab-case (e.g. `model-management`). Check it isn't an extension of an existing feature. If it only adds a tab or action to an existing feature, extend that feature instead.
- [ ] Write a short spec (goal, routes, permissions, data) and add a row to `progress.md`.
- [ ] Check it against `context/objectives.md` exclusions. Only build an excluded item if the user explicitly asks.

## 1. Backend domain
- [ ] `models/<domain>.py` → Alembic migration
- [ ] `schemas/<domain>.py`
- [ ] `services/<domain>/` (business rules, `visible_project_ids` filtering when the data is project-scoped, audit calls)
- [ ] `api/v1/<domain>.py`, registered in `api/v1/router.py`
- [ ] New permission codes go in `permissions/codes.py` and `matrix.py`. Add a seed migration or update step so the new codes are inserted into existing DBs.
- [ ] Tests in `tests/<domain>/` (happy path, permission matrix, 404 on out-of-scope data)

## 2. Frontend feature folder
```text
src/features/<feature>/
├── index.ts        ← public API (manifest + any components other features may embed)
├── manifest.ts     ← routes (lazy), nav item {label, path, icon, order, permission, section}
├── api/<feature>.api.ts, <feature>.queries.ts
├── pages/          components/          hooks/          model/          __tests__/
```
- [ ] Register it: add **one line** to `src/app/feature-registry.ts`.
- [ ] Use only `shared/*` and other features' `index.ts`. If you need another feature's internals, promote that piece to its public API or into `shared/`.
- [ ] Follow `rules/design-system.md` (PageHeader, cards/tables, badges, empty/error/loading states).
- [ ] Gate the UI with `<Can>` / `usePermission`. The backend enforces the same codes.

## 3. Cross-feature integration (optional)
- [ ] Dashboard widget: export a `<XWidget/>` from the feature's `index.ts` and render it in the dashboard.
- [ ] Project detail tab: export `<ProjectXTab projectId/>` and add a tab in projects.

## 4. Done
- [ ] `checklists/phase-done.md` passes.
- [ ] Update `progress.md` and, if architecture changed, `context/decisions.md`.

## Removing or disabling a feature
Remove its line from `feature-registry.ts`. Its routes and nav disappear, and no other code breaks as long as the dependency rules were followed.
