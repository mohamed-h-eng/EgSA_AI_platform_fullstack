# Security & Permission Model

## Roles (global)

`admin` · `project_lead` · `engineer` · `viewer`. These are seeded, and the set can be extended through DB rows.

## Permission codes

```text
users:read  users:create  users:update  users:disable
roles:read  roles:assign
projects:read  projects:create  projects:update  projects:delete  projects:manage_members
documents:read  documents:upload  documents:delete  documents:delete_any
chat:use
settings:read  settings:manage        (admin settings, AI config)
audit:read
```

## Default role → permission matrix (seed; source: plan §11)

| Permission                  | Admin | Project Lead | Engineer | Viewer |
| --------------------------- | :---: | :----------: | :------: | :----: |
| users:read                  | ✅ | ✅ | ✅ | – |
| users:create/update/disable | ✅ | – | – | – |
| roles:assign                | ✅ | – | – | – |
| projects:read               | ✅ | ✅ | ✅ | ✅ |
| projects:create             | ✅ | ✅ | – | – |
| projects:update / manage_members | ✅ | ✅ (own projects) | – | – |
| projects:delete             | ✅ | – | – | – |
| documents:read              | ✅ | ✅ | ✅ | ✅ |
| documents:upload            | ✅ | ✅ | ✅ | – |
| documents:delete (own)      | ✅ | ✅ | ✅ | – |
| documents:delete_any        | ✅ | ✅ (own projects) | – | – |
| chat:use                    | ✅ | ✅ | ✅ | ✅ |
| settings:manage, audit:read | ✅ | – | – | – |

## Project access rule (plan §16)

```text
can_access(user, project) = user.is_admin OR exists(project_members where user_id & project_id)
effective action = global permission  AND  can_access(project)
                   AND (project_role permits it, e.g. project Viewer cannot upload)
```

- Every list query for documents, projects, and project-linked conversations is **filtered in SQL** by `visible_project_ids(user)`. Never load everything and filter in Python.
- Detail, download, and delete endpoints re-check access → 404 if not visible.
- Conversations are **owner-only** in the POC (`conversation.user_id == current_user.id`). Keep a `visibility` column that defaults to `private`, ready for `project` and `shared` later.
- A project-linked conversation requires `can_access(project)` at creation time.

## Auth hardening checklist

- bcrypt password hashing. Never log passwords or tokens.
- Access token TTL **15 min**, refresh **8 h** in an httpOnly cookie (D15). Refresh tokens rotate on use.
- **Temporary passwords (D9):** admin-created and admin-reset users have `must_change_password=true`. While the flag is set, the backend rejects every endpoint except `/auth/me`, `/auth/logout`, and `/me/password` with `PASSWORD_CHANGE_REQUIRED` (403). The frontend redirects to the change-password screen.
- Temporary passwords are never stored in plain text or logged. The admin sees one only once, at creation or reset.
- A disabled user fails auth immediately, even with a valid token (check `is_active` in `get_current_user`).
- Rate-limit `/auth/login` (simple in-memory limiter is fine for the POC).
- Uploads: allow-list extensions **and** MIME sniffing (`pdf, docx, txt`), enforce max size, store under a UUID key, and serve with `Content-Disposition: attachment` (or `inline` for PDF view).
- CORS: only the frontend origin. In Docker, same-origin through Nginx.
- `OPENROUTER_API_KEY` lives only in backend env. The frontend never receives it.
- **Network (D1):** the backend is the only component with outbound internet access, and only to `openrouter.ai`. The frontend must not reference any public CDN (fonts, scripts, images).
- **Soft-deleted rows (D16):** every query for conversations and projects excludes `deleted_at IS NOT NULL`. A soft-deleted resource returns 404.
