# .agent — EgSA AI Engineering Platform (POC) Workflow

This folder holds the working instructions for building the POC described in
`../plan.md`, with the visual rules from `../design.md`.
It defines **what to build, in what order, and the rules to follow**. It is a plan only; nothing here has been run yet.

> Source of truth priority: `.agent/rules/*` > `.agent/workflows/*` > `plan.md` > `design.md`.
> Where this folder and `plan.md` disagree (for example the **frontend folder structure**), follow this folder.

## How to reference in chat

| You want to…                              | Say something like                                              |
| ----------------------------------------- | --------------------------------------------------------------- |
| Start / continue the build                | "Run `.agent/workflows/01-foundation.md`"                       |
| Execute the next pending phase            | "Continue with the next phase in `.agent/progress.md`"          |
| Add a new frontend/backend feature        | "Add feature `X` following `.agent/workflows/add-feature.md`"   |
| Check a phase is really done              | "Verify phase 05 against `.agent/checklists/phase-done.md`"     |
| Rehearse the final demo                   | "Walk through `.agent/checklists/demo-acceptance.md`"           |
| Fix deferred issues                       | "Fix B1 and B2 from `.agent/backlog.md`"                        |

## Layout

```text
.agent/
├── README.md                      ← you are here (index)
├── progress.md                    ← phase status tracker (update after every phase)
├── backlog.md                     ← known issues deferred for later (B1, B2, …)
│
├── context/
│   ├── objectives.md              ← POC goal, scope, explicit exclusions
│   └── decisions.md               ← stack + architectural decisions (ADR-lite)
│
├── rules/                         ← always-on constraints, apply to every phase
│   ├── frontend-architecture.md   ← FEATURE-SCOPED folder structure (overrides plan §32)
│   ├── backend-architecture.md    ← FastAPI layout, layering, conventions
│   ├── security-permissions.md    ← RBAC + project membership rules
│   └── design-system.md           ← UI tokens & conventions (summary of design.md)
│
├── workflows/
│   ├── 00-overview.md             ← phase order, dependencies, timeline
│   ├── 01-foundation.md           ← repo, Docker, FE↔BE↔DB wiring
│   ├── 02-authentication.md
│   ├── 03-users-permissions.md
│   ├── 04-projects.md
│   ├── 05-documents.md
│   ├── 06-chat-backend.md
│   ├── 07-openrouter.md
│   ├── 08-chat-ui.md
│   ├── 09-dashboard-polish.md     ← dashboard, settings, audit, notifications
│   ├── 10-testing.md
│   └── add-feature.md             ← repeatable recipe for scaling with new features
│
└── checklists/
    ├── phase-done.md              ← Definition of Done for any phase
    └── demo-acceptance.md         ← end-to-end POC demo script (plan §46)
```

## Golden rules (short version)

1. **Build the platform that hosts the AI, not the AI platform.** No RAG, embeddings, Qdrant, or local LLMs (see `context/objectives.md`).
2. **Permissions come before AI.** Project-membership filtering must exist before chat hits OpenRouter.
3. **Every frontend feature lives in `src/features/<name>/`**, is self-contained, and exposes a public `index.ts`. Features never import each other's internals.
4. **Only the backend talks to OpenRouter.** No API keys in the frontend, ever.
5. **Swappable seams:** `StorageService`, `AIProvider`, and `AuthProvider` are interfaces, so MinIO, RAG, or LDAP can replace the current implementation later without a rewrite.
6. After each phase, run `checklists/phase-done.md` and update `progress.md`.
7. **Confirmed decisions D1–D16** (`context/decisions.md`) apply to every phase: internal network only, English UI with Arabic chat, streaming, shadcn/ui, uv + pnpm, soft-delete, and the rest.
