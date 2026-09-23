# Phase 04: Projects & Membership (2–3 days)

**Goal:** Projects → Members → (later Documents and Chat). Membership drives access. Plan §12 and §38.

## Prerequisites
Phase 03 done.

## Backend
- [ ] Models: `Project` (id, code e.g. `NEXSAT-1` unique, name, description, subsystem optional, status enum [planning, in_development, testing, operational, archived], image_key optional, created_by, timestamps, **deleted_at**). `ProjectMember` (project_id, user_id, project_role [lead, engineer, viewer], added_at, unique pair).
- [ ] Migration.
- [ ] `permissions/policies.py`: `can_access_project(user, project_id)`, `visible_project_ids(user)` (admin → all), `project_role(user, project_id)`.
- [ ] Add a `require_project_access(action)` dependency.
- [ ] `services/projects`: CRUD, list visible projects (with doc and member counts), members add/update role/remove.
- [ ] Routes:
  ```text
  GET    /api/v1/projects?q=&status=           projects:read   (filtered by membership)
  POST   /api/v1/projects                      projects:create (creator becomes lead)
  GET    /api/v1/projects/{id}                 projects:read + access → else 404
  PATCH  /api/v1/projects/{id}                 projects:update + lead/admin
  DELETE /api/v1/projects/{id}                 projects:delete → SOFT delete (D16): sets deleted_at; project,
                                               its documents & linked conversations become invisible (404);
                                               files are kept; recoverable via DB
  GET    /api/v1/projects/{id}/members
  POST   /api/v1/projects/{id}/members         projects:manage_members
  PATCH  /api/v1/projects/{id}/members/{uid}
  DELETE /api/v1/projects/{id}/members/{uid}
  GET    /api/v1/users/{id}/projects           (for the user drawer)
  ```
- [ ] Audit: `project.create`, `project.update`, `project.delete`, `project.member_add`, `project.member_role_change`, `project.member_remove`.
- [ ] `visible_project_ids()` excludes soft-deleted projects.
- [ ] **Demo seed (required, D12, `SEED_DEMO=true`)** in `database/seed_demo.py`, idempotent:
  - Projects: NEXSAT-1 (EPS, In Development), EgyptSat-2 (Operational), SAR (Planning)
  - Users (all fake, **no** forced password change so the demo runs smoothly): one Admin, one Project Lead (NEXSAT-1), Mohamed-style Engineer (NEXSAT-1 only), and a Viewer (NEXSAT-1), plus an Engineer on SAR only to demonstrate isolation
  - Phase 05 extends the seed with placeholder documents, and phase 06 with sample conversations.

## Frontend: `features/projects` (+ extend `features/users`)
- [ ] `pages/ProjectsPage.tsx`: PageHeader, filters, a grid of **ProjectCard** (design §27: image, code, name, status badge, doc/member counts), "New Project" behind `<Can>`.
- [ ] `pages/ProjectDetailPage.tsx`: breadcrumb, header, Tabs `[Overview] [Documents] [Members] [Activity]`. The Documents tab embeds the public component from `features/documents` after phase 05, and until then shows a placeholder.
- [ ] `components/MembersTable.tsx`, `AddMemberModal.tsx` (user search), and a role select.
- [ ] `components/ProjectFormModal.tsx` for create/edit.
- [ ] `index.ts` exports `ProjectSelect` (reused by documents and chat) and `useVisibleProjects`.
- [ ] In `features/users`, the UserDrawer "Projects" section can assign/remove projects using the projects public API.
- [ ] `manifest.ts`: `/projects`, `/projects/:id`, nav "Projects".

## Verification
- An Engineer who is a member of NEXSAT-1 only sees NEXSAT-1, and a direct GET on SAR returns 404.
- A Lead can manage members of their own project but not other projects.
- Deleting a project hides it and its documents everywhere, and the DB row still exists.
- Tests: visibility filter, 404 on non-member, member management permissions, soft-delete hides the project.

## Deliverable
Projects with members, and the access rule working end-to-end.

## Out of scope
Project knowledge pages, subsystem hierarchy beyond a single field.
