# EgSA AI Engineering Platform — POC Plan

## 1. POC Objective

For the first version, **do not build the full AI/RAG engineering platform**.

The goal is to prove that the core platform works:

> **Users can log in, access permitted projects/documents, chat with an AI model through OpenRouter, keep conversation history, and manage documents — all through one interface.**

The AI should initially be treated as an external API capability.

```text
                    EgSA POC
                       │
        ┌──────────────┴──────────────┐
        │                             │
   Normal Platform              AI Capability
        │                             │
        ▼                             ▼
 Authentication                OpenRouter API
 Users                         Free Models
 Roles                         Chat
 Permissions
 Projects
 Documents
 Chat History
```

No local LLM, embeddings, Qdrant, RAG pipeline, reranker, model serving, or advanced AI evaluation in this phase.

---

# 2. POC Scope

## Include

### Platform

* Authentication
* Users
* Roles
* Permissions
* Projects
* Project membership
* Documents
* Document upload
* Document download/view
* Document metadata
* Document deletion
* Basic document categorization
* Chat history
* Conversations
* Messages
* User dashboard
* Admin dashboard
* Basic audit logging

### AI

* OpenRouter integration
* Free models
* Chat interface
* Streaming responses if practical
* Model selection
* Basic system prompt
* Conversation context
* Chat history persistence
* Error handling
* Usage tracking

---

# 3. Explicitly Exclude From POC

These should **not** consume development time yet:

```text
❌ Local LLM
❌ vLLM
❌ Qdrant
❌ Embeddings
❌ RAG
❌ Reranking
❌ Document chunking
❌ Semantic search
❌ AI document grounding
❌ AI citations
❌ AI evaluation framework
❌ Model benchmarking
❌ Automatic document indexing
❌ Knowledge-gap detection
❌ Advanced analytics
❌ VS Code integration
❌ Complex AI agents
❌ Workflow automation
```

They can be added after the POC proves the platform foundation.

---

# 4. POC Architecture

Keep the architecture simple.

```text
                    ┌─────────────────────┐
                    │      React UI       │
                    │    TypeScript       │
                    └──────────┬──────────┘
                               │
                              HTTPS
                               │
                               ▼
                    ┌─────────────────────┐
                    │     Backend API     │
                    │       FastAPI       │
                    └──────────┬──────────┘
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
       ┌───────────┐     ┌────────────┐    ┌─────────────┐
       │PostgreSQL │     │ File Store │    │  OpenRouter │
       │           │     │            │    │     API     │
       └───────────┘     └────────────┘    └─────────────┘
```

For the POC, this is enough.

---

# 5. Recommended Stack

| Component         | Technology                 |
| ----------------- | -------------------------- |
| Frontend          | React + TypeScript         |
| Styling           | Tailwind CSS               |
| Backend           | Python + FastAPI           |
| Database          | PostgreSQL                 |
| ORM               | SQLAlchemy                 |
| Validation        | Pydantic                   |
| Authentication    | JWT initially              |
| File Storage      | Local filesystem initially |
| AI Provider       | OpenRouter                 |
| AI Models         | OpenRouter free models     |
| API Communication | REST                       |
| Deployment        | Docker                     |
| Reverse Proxy     | Nginx                      |
| Version Control   | Git                        |

### Why Python/FastAPI?

For this POC, either Node.js or Python would work.

I'm still recommending **FastAPI** because the next phase will introduce:

```text
Document processing
RAG
Embeddings
LLM processing
AI evaluation
```

and Python will make that transition easier.

---

# 6. Frontend Structure

The UI should roughly follow the screens you already designed.

```text
Application
│
├── Login
│
├── Dashboard
│
├── AI Chat
│
├── Conversations
│
├── Documents
│
├── Projects
│
├── Users & Access
│
└── Settings
```

---

# 7. Dashboard

The first dashboard doesn't need complicated analytics.

Show:

```text
Welcome, Ahmed

┌──────────────┐
│ My Projects  │
│      3       │
└──────────────┘

┌──────────────┐
│ Documents    │
│     128      │
└──────────────┘

┌──────────────┐
│ Conversations│
│      15      │
└──────────────┘

┌──────────────┐
│ AI Requests  │
│      42      │
└──────────────┘
```

And:

* Recent conversations
* Recent documents
* My projects
* Quick "New Chat"

---

# 8. Authentication

Implement the complete authentication flow first.

```text
Login
  ↓
Backend
  ↓
Validate credentials
  ↓
Generate JWT
  ↓
Frontend stores session
  ↓
Protected routes
```

Routes:

```text
POST /auth/login
POST /auth/logout
GET  /auth/me
POST /auth/refresh
```

Later you can replace/extend this with:

```text
LDAP
Active Directory
SSO
```

without redesigning the entire application.

---

# 9. Users

Admin should be able to:

* Create user
* Disable user
* Enable user
* Change role
* View user
* Search users
* Assign projects

Example:

```text
Mohamed Hany
Data Scientist
Active

Projects:
├── NEXSAT-1
├── EgyptSat-2
└── SAR
```

---

# 10. Roles

Start with only a few roles.

```text
Admin
Project Lead
Engineer
Viewer
```

Don't create six or ten roles yet.

The permissions system should be flexible enough to add them later.

---

# 11. Permission System

Use simple RBAC + project permissions.

Example:

```text
Role: Engineer

Users
    Read

Projects
    Read

Documents
    Read
    Upload

Chat
    Use

Administration
    None
```

Admin:

```text
Users
    Read
    Create
    Update
    Disable

Projects
    Full Access

Documents
    Full Access

Chat
    Full Access

Settings
    Full Access
```

---

# 12. Project Management

Create a simple project module.

### Project

```text
Project ID
Name
Description
Status
Created By
Created At
```

Example:

```text
NEXSAT-1
Electrical Power System
Status: In Development
```

### Project members

```text
Project
   │
   ├── Ahmed → Lead
   ├── Mohamed → Engineer
   └── Sara → Viewer
```

This will become extremely important later when RAG is introduced.

---

# 13. Documents

This is one of the main POC features.

Users should be able to:

```text
Upload
View
Download
Delete
Search
Filter
```

Initially support:

```text
PDF
DOCX
TXT
```

Don't process the contents with AI yet.

Simply store the files.

---

# 14. Document Metadata

Every document should have:

```text
Document ID
Title
Description
Project
Category
File Type
File Size
Uploaded By
Uploaded At
Status
```

Example:

```text
EPS-SRS-001

Title:
Electrical Power System Requirements

Project:
NEXSAT-1

Category:
Requirements

Type:
PDF

Uploaded by:
Mohamed Hany

Status:
Approved
```

---

# 15. Document Storage

For the POC:

```text
Backend
   │
   ├── PostgreSQL
   │      └── metadata
   │
   └── /storage
          ├── documents
          └── ...
```

Don't introduce MinIO unless you actually need it during the POC.

However, create a storage abstraction:

```python
class StorageService:
    upload()
    download()
    delete()
```

Then later:

```text
LocalStorage
     ↓
MinIOStorage
```

can be swapped without changing the document system.

---

# 16. Document Permissions

A user should only see documents belonging to projects they can access.

Example:

```text
User
 ↓
Project Membership
 ↓
Document
```

If:

```text
Ahmed → NEXSAT-1 ✓
Ahmed → SAR ✗
```

then:

```text
NEXSAT-1 documents → accessible
SAR documents       → inaccessible
```

This permission model should be implemented **before AI integration**.

Later, the same permission mechanism can protect RAG retrieval.

---

# 17. AI Chat

The first AI implementation should be deliberately simple.

```text
User
 ↓
React
 ↓
FastAPI
 ↓
OpenRouter
 ↓
Free Model
 ↓
FastAPI
 ↓
React
```

No RAG.

No vector database.

No embeddings.

---

# 18. OpenRouter Integration

Create a dedicated service:

```text
backend/
└── services/
    └── ai/
        └── openrouter.py
```

The backend should be the only component communicating with OpenRouter.

**Do not put the OpenRouter API key in React.**

Correct:

```text
React
  ↓
Your Backend
  ↓
OpenRouter
```

Not:

```text
React
  ↓
OpenRouter
```

This keeps the API key and provider configuration server-side.

---

# 19. AI Configuration

Create a simple configuration:

```env
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=...
DEFAULT_AI_MODEL=...
```

The actual free model should be configurable rather than hard-coded.

This makes it easy to switch models when OpenRouter's available free models change.

---

# 20. Model Selection

For the POC, allow the backend/admin to configure the model.

Potential UI:

```text
AI Model

[ Default Free Model ▼ ]

○ Model A
○ Model B
○ Model C
```

Don't build the full model-management dashboard from the screenshots yet.

Just provide:

```text
GET /ai/models
```

and:

```text
POST /admin/ai/config
```

if needed.

---

# 21. Chat Data Model

Keep conversations separate from messages.

```text
Conversation
    │
    ├── Message
    ├── Message
    ├── Message
    └── Message
```

### Conversation

```text
id
user_id
project_id
title
created_at
updated_at
```

### Message

```text
id
conversation_id
role
content
model
created_at
```

Roles:

```text
user
assistant
system
```

---

# 22. Chat API

Basic API:

```text
POST   /conversations
GET    /conversations
GET    /conversations/{id}
DELETE /conversations/{id}

POST   /conversations/{id}/messages
GET    /conversations/{id}/messages
```

Flow:

```text
User sends message
       ↓
Backend checks conversation permission
       ↓
Save user message
       ↓
Load conversation history
       ↓
Send context to OpenRouter
       ↓
Receive response
       ↓
Save assistant message
       ↓
Return response
```

---

# 23. Chat History

The user should see:

```text
Today

Battery requirements
CAN timeout analysis
EPS review

Yesterday

NEXSAT-1 block diagram
Thermal analysis
```

Clicking a conversation should restore the conversation.

---

# 24. Project-Aware Chat

Even without RAG, conversations should optionally belong to a project.

Example:

```text
Conversation

Title:
Battery undervoltage requirements

Project:
NEXSAT-1 / EPS
```

The project context can be sent to the model as metadata/system context:

```text
Current project:
NEXSAT-1

Subsystem:
EPS
```

But don't pretend that the AI has knowledge of the project's documents yet.

---

# 25. AI Chat UI

Keep the UI close to the provided design.

```text
┌───────────────────────────────────────────────┐
│ Battery undervoltage requirements             │
├───────────────────────────────────────────────┤
│                                               │
│ User                                           │
│ What are typical battery requirements?        │
│                                               │
│ AI                                             │
│ Here is a general explanation...              │
│                                               │
├───────────────────────────────────────────────┤
│ Ask about engineering...              [Send]  │
└───────────────────────────────────────────────┘
```

For now, replace:

```text
"Based on EgSA Documents"
```

with something like:

```text
"AI Response"
```

because there is no RAG yet.

---

# 26. Streaming

If OpenRouter supports the desired streaming setup, implement:

```text
User
 ↓
Backend
 ↓
OpenRouter streaming
 ↓
SSE / streaming response
 ↓
React
```

This makes the interface feel significantly more responsive.

But streaming should not delay the core POC.

If necessary, implement normal request/response first.

---

# 27. Chat Permissions

Users should only access their own conversations initially.

Later you can introduce:

```text
Private
Project
Shared
```

Example:

```text
Conversation
     │
     ├── Owner
     ├── Project
     └── Visibility
```

This prepares the system for team collaboration.

---

# 28. Audit Logging

Add a lightweight audit system.

Record:

```text
Login
Logout
Document upload
Document deletion
Document download
Project creation
User creation
Role changes
Permission changes
AI request
```

Example:

```text
Ahmed
uploaded
EPS-SRS-001.pdf

10:42 AM
```

Don't build the elaborate audit dashboard yet.

Just make sure the data exists.

---

# 29. Notifications

Basic notifications can be implemented.

Examples:

```text
Document uploaded successfully
Document deleted
User added
Project access granted
AI request failed
```

Email notifications are not necessary for the POC.

---

# 30. Settings

Keep settings minimal.

### User settings

```text
Name
Email
Password
Profile
```

### Admin settings

```text
Default AI model
OpenRouter configuration
Maximum file size
Allowed file types
```

---

# 31. Backend Structure

Recommended:

```text
backend/
│
├── app/
│   │
│   ├── main.py
│   │
│   ├── api/
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── projects.py
│   │   ├── documents.py
│   │   ├── conversations.py
│   │   └── admin.py
│   │
│   ├── models/
│   │   ├── user.py
│   │   ├── role.py
│   │   ├── project.py
│   │   ├── document.py
│   │   ├── conversation.py
│   │   └── audit.py
│   │
│   ├── schemas/
│   │
│   ├── services/
│   │   ├── auth/
│   │   ├── documents/
│   │   ├── projects/
│   │   ├── chat/
│   │   └── ai/
│   │       └── openrouter.py
│   │
│   ├── permissions/
│   │
│   ├── storage/
│   │
│   └── database/
│
├── tests/
├── requirements.txt
└── Dockerfile
```

---

# 32. Frontend Structure

```text
frontend/
│
├── src/
│   ├── components/
│   ├── layouts/
│   │
│   ├── pages/
│   │   ├── Login/
│   │   ├── Dashboard/
│   │   ├── Chat/
│   │   ├── Documents/
│   │   ├── Projects/
│   │   ├── Users/
│   │   └── Settings/
│   │
│   ├── services/
│   │   └── api.ts
│   │
│   ├── hooks/
│   ├── context/
│   │   └── AuthContext.tsx
│   │
│   ├── types/
│   └── App.tsx
```

---

# 33. POC Database

Keep the initial database relatively small.

```text
users
roles
permissions
user_roles

projects
project_members

documents
document_permissions

conversations
messages

audit_logs

ai_settings
```

Don't create the future RAG tables yet.

---

# 34. Core Relationships

```text
User
 │
 ├───────────────┐
 │               │
 ▼               ▼
Role          ProjectMember
                 │
                 ▼
               Project
                 │
                 ▼
              Documents


User
 │
 ▼
Conversation
 │
 ▼
Messages
 │
 ▼
OpenRouter
```

---

# 35. POC Development Order

## Phase 1 — Project Foundation

**2–3 days**

Set up:

```text
Git
React
FastAPI
PostgreSQL
Docker
Environment variables
Basic API structure
```

Deliverable:

```text
Frontend ↔ Backend ↔ Database
```

working.

---

# 36. Phase 2 — Authentication

**2–3 days**

Implement:

* User model
* Password hashing
* Login
* JWT
* Protected routes
* Current user
* Logout
* Basic role system

Deliverable:

```text
Login → Dashboard
```

---

# 37. Phase 3 — Users & Permissions

**3–4 days**

Implement:

* Admin user management
* Roles
* Project membership
* Permission middleware
* Protected API endpoints
* Frontend permission-aware navigation

Deliverable:

```text
Admin
Engineer
Viewer
```

behave differently.

---

# 38. Phase 4 — Projects

**2–3 days**

Implement:

* Create project
* Edit project
* Delete project
* Project details
* Members
* Project access

Deliverable:

```text
Projects
   ↓
Members
   ↓
Documents / Chat
```

---

# 39. Phase 5 — Documents

**4–5 days**

Implement:

* Upload
* Download
* Delete
* Metadata
* Project association
* File type validation
* File size validation
* Permissions
* Document listing
* Search/filter

Deliverable:

> A usable internal engineering document library.

---

# 40. Phase 6 — Chat Backend

**3–4 days**

Implement:

```text
Conversation
Message
History
Permissions
Project association
```

Before AI:

```text
User
 ↓
Create conversation
 ↓
Save messages
```

Make sure chat history works independently of OpenRouter.

---

# 41. Phase 7 — OpenRouter

**2–3 days**

Implement:

```text
OpenRouterService
       ↓
API request
       ↓
Selected free model
       ↓
Response
```

Then connect it to:

```text
Conversation
     ↓
Messages
     ↓
OpenRouter
```

---

# 42. Phase 8 — Chat UI

**3–4 days**

Implement:

* Conversation list
* New chat
* Chat messages
* Input box
* Send
* Loading state
* Error state
* Streaming if practical
* Rename conversation
* Delete conversation

---

# 43. Phase 9 — Dashboard & Polish

**2–3 days**

Add:

* Dashboard statistics
* Recent activity
* Recent documents
* Recent chats
* Navigation
* Empty states
* Error states
* Responsive layout

---

# 44. Phase 10 — Testing

**3–5 days**

Test:

### Authentication

```text
Login
Logout
Invalid credentials
Expired token
```

### Permissions

```text
Admin → everything
Engineer → assigned projects
Viewer → read-only
```

### Documents

```text
Upload
Download
Delete
Wrong file type
Large file
Unauthorized access
```

### Chat

```text
New conversation
History
Multiple conversations
Unauthorized conversation
OpenRouter failure
Model unavailable
```

---

# 45. Approximate POC Timeline

A realistic first POC:

```text
Week 1
├── Project setup
├── Database
├── Authentication
├── Roles
└── Basic permissions

Week 2
├── Projects
├── Project members
└── Documents

Week 3
├── Document management polish
├── Chat database
└── Conversation history

Week 4
├── OpenRouter
├── AI chat
└── Model configuration

Week 5
├── Dashboard
├── Admin UI
├── Audit logs
└── Testing
```

So approximately **4–5 weeks** for a solid POC, depending on how polished the UI needs to be.

---

# 46. What the POC Should Demonstrate

At the end, you should be able to demonstrate this complete flow:

```text
                    LOGIN
                      │
                      ▼
                 DASHBOARD
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       PROJECTS    DOCUMENTS     AI CHAT
          │           │           │
          │           │           ▼
          │           │       Conversation
          │           │           │
          │           │           ▼
          │           │       OpenRouter
          │           │           │
          │           │           ▼
          │           │       AI Response
          │           │
          │           ▼
          │       File Storage
          │
          ▼
      Permissions
```

And an admin can demonstrate:

```text
Create user
      ↓
Assign role
      ↓
Give project access
      ↓
User logs in
      ↓
User sees permitted project
      ↓
User accesses permitted documents
      ↓
User starts AI conversation
      ↓
Conversation is saved
```

---

# 47. The Upgrade Path After POC

The important thing is to design the POC so the future AI functionality can be plugged in rather than rebuilt.

### POC

```text
Chat
  ↓
OpenRouter
```

### Later

```text
Chat
  ↓
AI Orchestrator
  ├── General AI → OpenRouter/local model
  │
  └── Knowledge AI
          ↓
        RAG
          ↓
      Qdrant
          ↓
       Reranker
          ↓
        LLM
```

Similarly:

### POC Documents

```text
Upload
 ↓
Storage
```

### Later

```text
Upload
 ↓
Storage
 ↓
Document Processing
 ↓
Chunking
 ↓
Embeddings
 ↓
Qdrant
 ↓
Knowledge Copilot
```

---

# 48. Final POC Architecture

```text
                         ┌───────────────┐
                         │     Users     │
                         └───────┬───────┘
                                 │
                                 ▼
                     ┌─────────────────────┐
                     │   React Frontend    │
                     │                     │
                     │ Dashboard           │
                     │ Chat                │
                     │ Documents           │
                     │ Projects            │
                     │ Users               │
                     │ Settings            │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │    FastAPI Backend  │
                     │                     │
                     │ Auth                │
                     │ Permissions         │
                     │ Users               │
                     │ Projects            │
                     │ Documents           │
                     │ Conversations       │
                     │ Audit               │
                     │ AI Service          │
                     └───────┬───────┬─────┘
                             │       │
                ┌────────────┘       └─────────────┐
                ▼                                  ▼
        ┌──────────────┐                   ┌───────────────┐
        │ PostgreSQL   │                   │ File Storage  │
        │              │                   │               │
        │ Users        │                   │ PDF           │
        │ Projects     │                   │ DOCX          │
        │ Documents    │                   │ TXT           │
        │ Conversations│                   └───────────────┘
        └──────────────┘
                │
                │
                ▼
        ┌────────────────┐
        │   OpenRouter   │
        │                │
        │ Free AI Models │
        └────────────────┘
```

## The main idea

**Don't build the AI platform yet. Build the platform that will host the AI.**

The POC should establish the difficult non-AI foundations first:

> **Identity → permissions → projects → documents → conversations → audit → API architecture**

Then OpenRouter provides a simple AI capability on top.

Once this works, the next stage can replace the simple:

```text
Chat → OpenRouter
```

with:

```text
Chat → AI Orchestrator → RAG → Qdrant → Reranker → LLM
```

without rebuilding authentication, permissions, projects, documents, conversations, or the frontend.
