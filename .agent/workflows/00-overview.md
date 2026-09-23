# Workflow Overview

## Execution protocol (applies to every phase)

1. **Read first:** `context/objectives.md`, the relevant `rules/*`, and this phase's file.
2. **Check prerequisites:** earlier phases are marked `done` in `progress.md`.
3. **Backend first, then frontend** within a phase: model → migration → schema → service → router → tests, then feature `api/` → `pages/` and `components/` → manifest.
4. **Stay in scope.** Anything listed under a phase's "Out of scope" or in `objectives.md` exclusions gets skipped.
5. **Verify** using the phase's *Verification* section and `checklists/phase-done.md`.
6. **Record** status, date, and deviations in `progress.md`.

## Phase order & dependencies

```text
01 Foundation
   └─► 02 Authentication
          └─► 03 Users & Permissions ──► 04 Projects ──► 05 Documents
                                                   └─► 06 Chat Backend ──► 07 OpenRouter ──► 08 Chat UI
                                                                                                │
                                   05 + 08 ───────────────────────────────► 09 Dashboard & Polish
                                                                                                │
                                                                                     10 Testing & Demo
```

- Permissions (03) **must** be finished before documents (05) and before AI (07). See plan §16.
- Chat history (06) must work **without** OpenRouter before 07 starts. See plan §40.
- Audit logging starts in 02 (login/logout), and each later phase adds its own events.
- Streaming is **required from the start** (D5). Phase 07 builds SSE as the main path and keeps non-streaming as a fallback.
- The demo seed (D12) grows phase by phase: users and projects (04), documents (05), conversations (06).
- Confirmed decisions D1–D16 are in `context/decisions.md`. Read them before starting any phase.

## Timeline (plan §45)

| Week | Phases                                      |
| ---- | ------------------------------------------- |
| 1    | 01 Foundation, 02 Auth, 03 Roles/Permissions |
| 2    | 04 Projects, 05 Documents                   |
| 3    | 05 polish, 06 Chat backend                  |
| 4    | 07 OpenRouter, 08 Chat UI, model config     |
| 5    | 09 Dashboard/Admin/Audit, 10 Testing        |

## Feature ownership map (frontend feature ↔ backend domain ↔ phase)

| Frontend feature | Backend domain(s)                 | Introduced | Extended   |
| ---------------- | --------------------------------- | ---------- | ---------- |
| auth             | auth, security                    | 02         | 03         |
| users            | users, roles, permissions         | 03         | 04 (assign projects) |
| projects         | projects, project_members         | 04         | 05, 09     |
| documents        | documents, storage                | 05         | 09         |
| chat             | conversations, messages, ai       | 06/07/08   | —          |
| dashboard        | dashboard                         | 02 (stub)  | 09         |
| settings         | me, admin settings, ai config     | 07 (AI)    | 09         |
| notifications    | none (client)                     | 02         | every phase |
| audit            | audit                             | 02 (BE)    | 09 (optional UI) |
