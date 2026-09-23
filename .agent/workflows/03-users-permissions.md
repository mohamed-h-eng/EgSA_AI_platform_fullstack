# Phase 03: Users & Permissions (3–4 days)

**Goal:** Admin, Engineer, and Viewer see and can do different things. Plan §9–11 and §37.

## Prerequisites
Phase 02 done.

## Backend
- [ ] `services/users`: create (admin types or generates a **temporary password**, and the user gets `must_change_password=true`, D9), **reset password** (new temp password, flag set again, the user's refresh tokens revoked), get, list/search (`q` on name/email, filter by role and status, paginated), update profile, change role, enable/disable.
- [ ] Routes (all behind permissions):
  ```text
  GET    /api/v1/users?q=&role=&status=&page=     users:read
  POST   /api/v1/users                            users:create
  GET    /api/v1/users/{id}                       users:read
  PATCH  /api/v1/users/{id}                       users:update
  POST   /api/v1/users/{id}/disable               users:disable
  POST   /api/v1/users/{id}/enable                users:disable
  PUT    /api/v1/users/{id}/role                  roles:assign
  POST   /api/v1/users/{id}/reset-password        users:update   → returns temp password ONCE
  GET    /api/v1/roles                            roles:read (with permission lists)
  ```
- [ ] Guardrails: an admin can't disable themselves or remove their own admin role, and at least one active admin must always exist.
- [ ] `permissions/policies.py` stubs: `is_admin()`, `has_permission()`, `visible_project_ids()` (filled in during phase 04).
- [ ] Permission middleware: every router uses `require_permission`. Add a test that walks all routes and asserts each one has an auth dependency, except the allow-list.
- [ ] Audit: `user.create`, `user.update`, `user.disable`, `user.enable`, `user.role_change`, `user.password_reset`. Never put the password itself in the audit record.

## Frontend: `features/users`
- [ ] `api/users.api.ts` and `users.queries.ts` (list, detail, create, update, disable/enable, change role, roles list).
- [ ] `pages/UsersPage.tsx`: PageHeader "Users & Access", SearchBar, role/status filters, Table (avatar, name, email, role badge, status badge, last login), pagination.
- [ ] `components/UserDrawer.tsx`: right-side detail panel (design §33) with profile, role, status, and projects (the projects list is filled in phase 04).
- [ ] `components/CreateUserModal.tsx` (with a "Generate" button for the temp password), `ChangeRoleModal.tsx`, a disable/enable confirm dialog, and `ResetPasswordDialog.tsx`.
- [ ] `components/TempPasswordReveal.tsx`: after create or reset, show the temp password **once** with a copy button and the note "Share this with the user securely. They must change it at first login."
- [ ] `manifest.ts`: route `/admin/users`, nav item in the "admin" section with permission `users:read`.
- [ ] **Permission-aware navigation:** Sidebar filters nav items by `usePermission`. Action buttons are wrapped in `<Can>`.

## Verification
- Admin can create a user, change their role, disable them, and re-enable them. The disabled user can't log in.
- The new user logs in with the temp password and is forced to set a new one. After an admin reset, they're forced again and their old sessions are revoked.
- Engineer can't see admin nav, and direct API calls return 403.
- Viewer gets read-only UI.
- Tests: permission matrix per role on each users endpoint, self-disable blocked, last-admin guard.

## Deliverable
Admin / Engineer / Viewer behave differently.

## Out of scope
Custom role editor UI (roles are seeded; the matrix is data-driven for later).
