# POC Objectives & Scope

## Objective

> Users can log in, open the projects and documents they are allowed to see, chat with an AI model through OpenRouter, keep their conversation history, and manage documents, all from one interface.

Treat the AI as an **external API capability**. The POC proves the platform foundation:

**Identity → permissions → projects → documents → conversations → audit → API architecture**, with OpenRouter chat on top.

## In scope

### Platform
- Authentication (JWT), logout, refresh, current user
- Users (create / enable / disable / change role / search / assign projects)
- Roles: **Admin, Project Lead, Engineer, Viewer** (no more for now; system must allow adding more)
- Permissions: RBAC + project membership
- Projects + project members (with per-project role: Lead / Engineer / Viewer)
- Documents: upload, view/download, delete, metadata, category, search, filter (PDF, DOCX, TXT)
- Conversations + messages + history
- User dashboard, admin dashboard
- Basic audit logging (data only, no elaborate audit UI)
- Basic in-app notifications (toasts)
- Minimal user & admin settings

### AI
- OpenRouter integration (backend only), free models, configurable model
- Chat UI, conversation context, history persistence
- Streaming (SSE) **from the start** (decision D5), with non-streaming kept as a fallback
- Chat messages may be Arabic (the UI is English only, decision D3)
- Permanent "no sensitive data" warning in chat (decision D2)

## Deployment context
Internal network only. The backend's call to OpenRouter is the single outbound internet dependency (decision D1).
See `decisions.md` → *Confirmed product decisions* for D1–D16.
- Basic system prompt + optional project context as metadata
- Error handling, usage tracking (requests/tokens per user)

## Explicitly OUT of scope (do not spend time here)

```text
Local LLM · vLLM · Qdrant · Embeddings · RAG · Reranking · Chunking
Semantic search · AI grounding · AI citations · AI evaluation · Benchmarking
Auto document indexing · Knowledge-gap detection · Advanced analytics
VS Code integration · Complex AI agents · Workflow automation · MinIO (unless needed)
Email notifications · Full model-management dashboard · Elaborate audit dashboard
```

UI copy must not suggest the AI knows EgSA documents. Label answers **"AI Response"**, not "Based on EgSA Documents".

## Future upgrade path (design seams now, build later)

```text
Chat → AIProvider(OpenRouter)            ⟶  Chat → AI Orchestrator → RAG → Qdrant → Reranker → LLM
Upload → StorageService(Local)           ⟶  Upload → Storage(MinIO) → Processing → Chunking → Embeddings
Auth → JWT (local users)                 ⟶  LDAP / Active Directory / SSO
Conversation visibility = private        ⟶  private / project / shared
```

## Success = demo passes

See `../checklists/demo-acceptance.md`.
