# Phase 10: Testing & Demo Readiness (3–5 days)

**Goal:** Prove the POC is correct and secure enough to demo. Plan §44 and §46.

## Prerequisites
Phases 01–09 done. By this point each phase already has its own tests. This phase closes the gaps and adds E2E coverage.

## Backend test matrix (pytest, separate test DB, mocked AIProvider and temp storage dir)

| Area        | Cases |
| ----------- | ----- |
| Auth        | login ok · invalid credentials · disabled user · expired access token · refresh rotation · refresh expires after 8 h · logout revokes refresh · rate limit · forced password change blocks other endpoints · admin reset re-forces change and revokes sessions |
| Permissions | parametrized matrix: each role × each endpoint → expected 2xx/403/404 · Admin → everything · Engineer → assigned projects only · Viewer → read-only · every route has auth dep (except allow-list) |
| Projects    | visibility filter · non-member 404 · lead manages own project only · soft-delete hides project + its docs + linked chats |
| Documents   | upload pdf/docx/txt · wrong type · spoofed extension · oversize · duplicate code in same project → 409 · same code in other project OK · download · delete removes file · unauthorized access 404 · search/filter (incl. Arabic text) |
| Chat        | new conversation · history order · multiple conversations isolated · other user's conversation 404 · project-linked access · soft-delete → 404 · Arabic content round-trip · Arabic-safe title truncation |
| AI          | streaming success saves tokens/model · client disconnect keeps partial + cancels upstream · non-stream fallback · OpenRouter 5xx/timeout → error message saved · 429 → AI_RATE_LIMITED · model unavailable/not allowed · no key configured · usage row per request |
| Audit       | each audited action writes exactly one row |

## Frontend tests
- Vitest + RTL: auth guard redirects, `<Can>` hides actions, upload modal validation, chat components, and dashboard rendering with mocked queries.
- Boundary lint passes (no cross-feature internal imports).

## E2E (Playwright, optional but recommended): runs `checklists/demo-acceptance.md`
1. Admin logs in, creates a user, assigns the Engineer role, and adds them to NEXSAT-1.
2. The Engineer logs in and sees only NEXSAT-1, uploads a PDF, and can't reach SAR docs by URL.
3. The Engineer starts a chat linked to NEXSAT-1 (mocked or real model), reloads, and the history persists.
4. A Viewer can't upload.

## Non-functional checks
- `grep` the frontend build for `OPENROUTER` / `sk-or-` and expect no match.
- `grep` the frontend build for `googleapis`, `cdn`, and `http://` / `https://` external hosts: no runtime external URLs (D1).
- `pre-commit run --all-files` passes (there's no CI, so this is the quality gate, D8).
- `docker compose up` from a clean clone plus `.env` works, with migrations and seed running automatically.
- Basic dependency audit (`pip-audit`, `npm audit`), with nothing critical left unaddressed.
- README: setup, env vars, seed credentials, how to run tests, known limitations.

## Deliverable
Green test suite, and a demo script that runs cleanly twice in a row.
