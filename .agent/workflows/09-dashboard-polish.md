# Phase 09: Dashboard, Settings, Audit & Polish (2–3 days)

**Goal:** A demo-ready product with a real dashboard, minimal settings, audit data available to admins, and consistent empty, error, and responsive states. Plan §7, §28–30, and §43.

## Prerequisites
Phases 05 and 08 done.

## Backend
- [ ] `GET /api/v1/dashboard/summary` returns data scoped to the current user:
  ```json
  { "counts": { "projects": 3, "documents": 128, "conversations": 15, "ai_requests": 42 },
    "recent_conversations": [...5], "recent_documents": [...5], "my_projects": [...] }
  ```
  Admins also get `admin: { active_users, total_users, total_documents, ai_requests_7d, failed_ai_requests_7d, top_ai_users_7d: [{user, requests, tokens}] }` (usage tracking, D11. No limits).
- [ ] `GET /api/v1/admin/audit-logs?actor=&action=&from=&to=&page=` (`audit:read`).
- [ ] Profile: `GET/PATCH /api/v1/me` (name, job title) and `POST /api/v1/me/password` (current and new).
- [ ] Admin settings: `GET/PUT /api/v1/admin/settings` (max file size, allowed file types), read by the document upload validation (DB value overrides env).
- [ ] Confirm every audit event in `rules/backend-architecture.md` is emitted (write a test that lists them).

## Frontend
- [ ] `features/dashboard`
  - HeroBanner: "Welcome, {name}", "Turn engineering knowledge into real progress.", "Ask. Search. Build. For a stronger space future.", EGYPTIAN SPACE AGENCY, satellite/Earth image.
  - 4 StatCards: My Projects, Documents, Conversations, AI Requests.
  - Panels: Recent conversations (`chat` public component), Recent documents (`documents`), My projects (`projects`), plus a Quick "New Chat" button.
  - Admin block (when `settings:manage`): user stats plus an **AI usage per user** table (requests and tokens, last 7 days) and the failed-request count.
- [ ] `features/settings`
  - `/settings`: profile (name, email read-only, job title) and change password.
  - `/admin/settings`: AI config (from phase 07) plus file limits and allowed types.
- [ ] `features/audit` (optional but cheap): `/admin/audit` table with filters. Admin only.
- [ ] `features/notifications`: make sure the plan §29 toasts exist (document uploaded/deleted, user added, project access granted, AI request failed).
- [ ] Polish pass on every page:
  - PageHeader pattern (design §31) and breadcrumbs on deep pages.
  - Empty, loading (skeletons), and error states on every list.
  - Global SearchBar in the header (Ctrl+K). For the POC it navigates to documents or projects search.
  - Responsive layout: collapsed sidebar on tablet, drawer nav on mobile, tables reflow into cards.
  - Sidebar footer tagline and EgSA logo asset.
  - Check a11y: focus rings, contrast, labels.

## Verification
- Dashboard numbers match the DB for Admin, Engineer, and Viewer (each scoped correctly).
- Changing the max file size in admin settings changes upload validation.
- Visual check against `rules/design-system.md` Do/Don't.

## Deliverable
Polished, coherent, demo-ready POC.

## Out of scope
Advanced analytics, charts beyond simple stats, elaborate audit dashboard, email notifications.
