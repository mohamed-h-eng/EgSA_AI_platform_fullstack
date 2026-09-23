# Phase 02: Authentication (2–3 days)

**Goal:** Login → Dashboard, with protected routes. Plan §8 and §36.

## Prerequisites
Phase 01 done.

## Backend
- [ ] Models: `User` (id, email unique, full_name, job_title, password_hash, is_active, **must_change_password**, password_changed_at, last_login_at, timestamps), `Role`, `Permission`, `role_permissions`, `user_roles`.
- [ ] `AuditLog` model (id, actor_id, action, target_type, target_id, meta JSONB, ip, created_at) plus `services/audit.log()`.
- [ ] Alembic migration.
- [ ] `core/security.py`: bcrypt hash/verify, create/decode access and refresh JWTs (claims `sub`, `type`, `exp`, `jti`).
- [ ] `permissions/codes.py` and `permissions/matrix.py` (from `rules/security-permissions.md`). `database/seed.py` seeds the 4 roles, all permissions, the matrix, and the admin user from env. The seed is idempotent.
- [ ] `api/deps.py`: `get_current_user` (validates token and `is_active`), `require_permission(code)`.
- [ ] `services/auth`: authenticate, issue tokens, rotate refresh, logout (revoke refresh via a `refresh_tokens` table or `token_version`).
- [ ] Routes:
  ```text
  POST /api/v1/auth/login     → { access_token, user } + sets httpOnly refresh cookie
  POST /api/v1/auth/refresh   → { access_token }       (reads cookie, rotates)
  POST /api/v1/auth/logout    → clears cookie, revokes refresh
  GET  /api/v1/auth/me        → { user, roles, permissions[], must_change_password }
  POST /api/v1/me/password    → { current_password, new_password } → clears must_change_password
  ```
- [ ] **Forced password change (D9):** in `get_current_user`, if `must_change_password` is set, allow only `/auth/me`, `/auth/logout`, and `/me/password`. Everything else returns 403 `PASSWORD_CHANGE_REQUIRED`. Password policy: minimum 10 characters, different from the temporary one.
- [ ] Token lifetimes: access **15 min**, refresh **8 h** (D15).
- [ ] Audit: `auth.login`, `auth.login_failed`, `auth.logout`, `auth.password_change`.
- [ ] Simple rate limit on login.
- [ ] Put the auth logic behind an `AuthProvider`-style service function so LDAP/AD/SSO can be added later (plan §8).

## Frontend: `features/auth`, `features/notifications`
- [ ] `features/auth/`
  - `api/auth.api.ts` (login, logout, refresh, me)
  - `model/` (AuthUser type, login zod schema)
  - `components/AuthProvider.tsx`: keeps the access token in memory and bootstraps with `refresh()` then `me()` on app load.
  - `hooks/useAuth.ts`, `hooks/usePermission.ts`, `components/Can.tsx`
  - `pages/LoginPage.tsx`: EgSA-branded (logo, product name, hero imagery), email/password, error state.
  - `pages/ChangePasswordPage.tsx`: shown when `must_change_password` is true ("Set your new password"). `RequireAuth` redirects every route here until the password is changed.
  - `manifest.ts`: public route `/login`, plus the authenticated-but-no-shell route `/change-password`.
  - `index.ts` exports AuthProvider, useAuth, usePermission, Can, and the manifest.
- [ ] `shared/api/http.ts`: attach the bearer token. On 401, refresh once and retry, otherwise log out and redirect to `/login`. Always send `credentials: 'include'`.
- [ ] `app/guards/RequireAuth.tsx` wraps the AppShell routes. `RequirePermission.tsx` takes a `permission` prop.
- [ ] Header user menu: avatar (initials), name, role, Logout.
- [ ] `features/notifications`: toaster provider plus a `notify.success/error()` helper exported from its index.
- [ ] Dashboard stub shows "Welcome, {name}".

## Verification
- Valid login opens the dashboard. Invalid credentials show an inline error. A disabled user is rejected.
- Refreshing the page keeps the session (cookie refresh). Logout clears it, and the back button doesn't restore protected pages.
- An expired access token is refreshed silently. After 8 h the user must log in again.
- A user with a temporary password is forced to change it, and all other API calls return `PASSWORD_CHANGE_REQUIRED` until they do.
- Tests: login ok/invalid/disabled, `/me` without token → 401, refresh rotation, audit rows written.

## Deliverable
`Login → Dashboard`.

## Out of scope
User management UI, LDAP/SSO, password reset emails.
