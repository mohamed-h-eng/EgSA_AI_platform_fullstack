> **How this file applies to the EgSA platform** (evaluated and adopted 2026-09-28)
>
> This is a generic enterprise-AI UI guide (written for "On-Prim AI"). Use it for **general UI
> practice only**. Precedence when rules conflict:
>
> 1. Decisions D1–D17 (`../context/decisions.md`)
> 2. EgSA brand and product rules: `design-system.md` and the root `design.md`
> 3. This file
>
> Adopted: principles (§2), restrained type scale (§4: page H1 24px/600, body 14px), 8px spacing
> (§7), restrained radius (§8: 6/8/10/12), **borders over shadows** (§9), icons (§10),
> responsive (§12), empty/loading/error states incl. "is my data safe" (§25–27), motion and
> `prefers-reduced-motion` (§29), accessibility (§30), UX writing (§31), component states and
> UI definition of done (§34, §38).
>
> Overridden for EgSA:
> - **Identity:** the product is "EgSA AI Engineering Platform" with EgSA logo, navy palette and
>   tagline. Ignore "On-Prim AI" / "Private Intelligence" branding (§1, §32, §39).
> - **Privacy wording (§2.3, §21):** chat messages ARE sent to an external AI provider (D1). Never
>   claim on-premise AI processing; the D2 warning banner stays.
> - **Hero banner:** kept (gradient + Earth/satellite art) despite §2.1/§32 (user decision).
> - **Navigation (§11):** keep Dashboard and Projects; Knowledge doesn't exist yet.
> - **Model name (§13):** stays visible on AI answers (user decision).
> - **Dark mode (§6):** deferred (backlog B5); the UI is light-only for now.
> - **Not built yet, don't add UI for them:** sources/citations, Knowledge, attach-in-composer
>   (need RAG; plan §25), Teams and per-document access (access is per project), Ready /
>   Processing / Failed document statuses (D7: status is a label), regenerate/feedback,
>   System Status page.

# On-Prim AI — Design System

## 1. Product Design Direction

On-Prim AI is a private, enterprise AI workspace for organizations that need conversational AI, company documents, knowledge retrieval, permissions, and administrative control.

### Design personality

- Professional
- Calm
- Trustworthy
- Private
- Intelligent
- Minimal
- Enterprise-oriented

The interface should feel like **company infrastructure**, not a flashy consumer AI product.

### Visual references

Use these products as inspiration for interaction quality and information hierarchy:

- Linear — clean workspace and navigation
- GitHub — technical/enterprise credibility
- ChatGPT — conversational interaction
- Notion — document and knowledge organization

Do not copy their visual identity. Build a distinct On-Prim AI brand.

---

# 2. Design Principles

## 2.1 Clarity over decoration

Prefer clear hierarchy, spacing, typography, and borders over gradients, excessive shadows, or decorative elements.

## 2.2 AI should feel integrated

AI is part of the workspace, not a separate visual universe.

Avoid:
- glowing AI orbs
- excessive purple gradients
- futuristic HUD interfaces
- unnecessary animations

## 2.3 Privacy should be visible

The product's on-premise/private nature is an important trust signal.

Security and privacy should appear naturally in:
- workspace status
- document access
- permissions
- administration
- AI configuration
- audit information

## 2.4 Dense but readable

This is an enterprise application. Users should be able to see useful information without excessive scrolling, while maintaining comfortable readability.

## 2.5 Progressive disclosure

Do not expose every technical detail by default.

Show:
1. The information needed for the current task.
2. Additional details on demand.

---

# 3. Technology / UI Foundation

Recommended frontend foundation:

- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Radix UI primitives
- Lucide icons

Use shadcn/ui as the component foundation, but customize the tokens and components to establish the On-Prim AI identity.

---

# 4. Typography

## Primary font

**Inter**

Use one primary typeface throughout the application.

### Type scale

| Role | Size | Weight |
|---|---:|---:|
| Display | 32px | 600 |
| H1 | 24px | 600 |
| H2 | 20px | 600 |
| H3 | 16px | 600 |
| Body | 14px | 400 |
| Body Large | 15px | 400 |
| Small | 13px | 400 |
| Caption | 12px | 400 |
| Button | 14px | 500 |

Avoid using many font sizes.

---

# 5. Color System

Use a neutral interface with a deep blue/indigo primary color.

Example token structure:

```css
:root {
  --background: 0 0% 98%;
  --foreground: 222 47% 11%;

  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;

  --primary: 221 83% 40%;
  --primary-foreground: 210 40% 98%;

  --secondary: 214 32% 95%;
  --secondary-foreground: 222 47% 11%;

  --muted: 210 20% 96%;
  --muted-foreground: 215 16% 47%;

  --border: 214 20% 90%;
  --input: 214 20% 90%;

  --success: 142 71% 35%;
  --warning: 38 92% 50%;
  --destructive: 0 72% 51%;
  --info: 204 94% 40%;
}
```

These are starting tokens, not mandatory final values.

## Color rules

- Primary color is used for actions and selected states.
- Neutral colors dominate the interface.
- Semantic colors are reserved for semantic meaning.
- Never use color alone to communicate important status.
- Avoid large saturated backgrounds.

---

# 6. Dark Mode

Dark mode is a first-class experience.

Dark mode should use near-black/charcoal surfaces rather than pure black.

Example direction:

```text
Application background  → very dark neutral
Sidebar                 → slightly different dark surface
Cards                   → elevated dark surface
Borders                 → subtle neutral border
Text                    → high-contrast neutral
Muted text              → lower-contrast neutral
Primary                 → slightly brighter blue
```

Do not simply invert the light theme.

---

# 7. Spacing

Use an 8px-based spacing system.

Preferred values:

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
```

Common usage:

```text
Page padding        24px
Card padding        16–24px
Section gap         24–32px
Form field gap      16px
Button gap          8px
Icon/text gap       8px
```

Avoid arbitrary spacing values unless necessary.

---

# 8. Border Radius

Use restrained rounding.

```text
Small controls      6px
Inputs/buttons      8px
Cards               10px
Large containers    12px
Modal/dialog        12px
```

Avoid making every element extremely rounded.

Pills should be reserved for:
- status indicators
- tags
- filters
- compact metadata

---

# 9. Shadows

Prefer borders over shadows.

Default:

```text
border: 1px solid var(--border)
```

Use shadows mainly for floating elements:

- Dialogs
- Dropdowns
- Command menus
- Popovers
- Floating panels

Do not give every card a shadow.

---

# 10. Iconography

Use **Lucide Icons**.

Rules:

- Default size: 16–20px
- Use 20px for navigation
- Use 16px for compact controls
- Keep icon stroke weight consistent
- Do not mix icon libraries without a reason

Icons should support meaning, not replace text for important actions.

---

# 11. Application Layout

Primary application structure:

```text
┌──────────────────────────────────────────────────────────────┐
│ Workspace / Brand                         User / Settings   │
├───────────────┬──────────────────────────────────────────────┤
│               │                                              │
│ + New Chat    │                                              │
│               │                                              │
│ Chats         │                 Main Workspace               │
│ Documents     │                                              │
│ Knowledge     │                                              │
│               │                                              │
│ Administration│                                              │
│ Settings      │                                              │
│               │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

## Sidebar

Primary navigation:

- New Chat
- Chats
- Documents
- Knowledge
- Administration
- Settings

The sidebar should support:
- collapsed state
- active item state
- workspace identity
- user menu
- responsive behavior

Do not overload the sidebar with every possible setting.

---

# 12. Responsive Design

Desktop is the primary environment, but the interface should remain usable on smaller screens.

## Desktop

```text
Sidebar + main workspace
```

## Tablet

```text
Collapsed sidebar + main workspace
```

## Mobile

```text
Top bar
Main content
Bottom/sheet navigation where appropriate
```

Tables should transform into cards or horizontally scroll when necessary.

---

# 13. Chat Experience

Chat is the primary product experience.

## Layout

```text
                  AI Assistant

       How does our vacation policy work?

AI
According to the company policy...

Sources
────────────────────────────────
HR Policy.pdf          Page 12
Leave Policy.docx      Page 4
────────────────────────────────

┌──────────────────────────────────────────┐
│ Ask anything...                       ↑  │
└──────────────────────────────────────────┘
```

## Chat rules

- Keep the conversation visually lightweight.
- Do not put every message inside a large card.
- User messages may use a subtle surface.
- Assistant messages should be optimized for reading.
- Markdown is supported.
- Code blocks must be visually distinct.
- Tables should remain readable.
- Sources should be accessible but not dominate the response.
- Long responses should have comfortable line length.

## Message actions

Useful actions:

- Copy
- Regenerate
- Feedback
- View sources
- More

Do not expose technical model metadata unless relevant.

---

# 14. AI Source / Citation UI

When an answer uses company documents, sources should be visible.

Example:

```text
Sources
────────────────────────────
HR Policy.pdf
Page 12 · Relevant section

Employee Handbook.docx
Page 8 · Relevant section
```

Source cards should:
- show document name
- show page/section when available
- be clickable
- make provenance clear
- avoid overwhelming the answer

---

# 15. Chat Composer

The composer should be the main interaction focus.

Example:

```text
┌──────────────────────────────────────────────────┐
│ Ask anything...                                  │
│                                                  │
│  ＋ Attach       Model: Default             ↑    │
└──────────────────────────────────────────────────┘
```

Possible controls:

- Attach document
- Model selector
- Send
- Stop generation
- Clear/temporary conversation options where appropriate

The composer should support keyboard-first interaction.

---

# 16. Documents

Documents should feel like a document-management workspace rather than a chat feature.

Example:

```text
Documents

[ Search documents... ]                     [ Upload ]

Name                    Type      Size       Status
──────────────────────────────────────────────────────
HR Policy               PDF       2.4 MB     ● Ready
Employee Handbook       DOCX      1.1 MB     ● Ready
Financial Report        PDF       8.2 MB     ● Processing
```

## Document statuses

Use consistent statuses:

- Ready
- Processing
- Failed
- Archived
- Restricted

Each status must have both:
- text
- semantic visual indicator

---

# 17. Knowledge

Knowledge represents the information available to the AI system.

Possible sections:

```text
Knowledge

Company Documents
Shared Knowledge
Collections
Sources
Indexing Status
```

Make the relationship between documents and AI knowledge understandable.

Avoid exposing vector databases, embeddings, chunking, or retrieval internals to normal users.

These belong in technical/admin interfaces only.

---

# 18. Permissions

Permissions are a core product concept.

Use clear language:

```text
Who can access this?

○ Everyone in the workspace
○ Selected teams
○ Selected users
○ Private
```

Avoid technical permission terminology where a simpler phrase works.

For administrators, provide detailed controls:

```text
Users
Teams
Roles
Document Access
AI Access
Audit Logs
```

---

# 19. Administration

Administration should use a dashboard-style layout.

Recommended sections:

```text
Administration

Overview
Users
Teams & Roles
Documents
Permissions
AI Configuration
System Status
Audit Logs
```

Admin screens can be denser than regular user screens.

---

# 20. System Status

Because this is an on-premise system, system health can be valuable.

Example:

```text
System Status

AI Service             ● Operational
Document Processing    ● Operational
Database               ● Operational
Storage                ● Operational

Last checked: 10:42 AM
```

Use simple status indicators.

Avoid turning the dashboard into a monitoring tool unless monitoring is an explicit requirement.

---

# 21. Security / Privacy

Privacy messaging should be factual and concise.

Example:

```text
Private workspace

Your organization's AI conversations and documents
are processed within the configured company environment.
```

Do not make absolute security claims unless the implementation guarantees them.

---

# 22. Forms

Form conventions:

```text
Label
Input
Helper text / validation
```

Example:

```text
Workspace name
[ Acme Corporation                         ]

Used to identify your organization workspace.
```

Rules:

- Labels are always visible.
- Placeholder text is not a replacement for labels.
- Validation appears near the relevant field.
- Required fields should be clearly marked.
- Avoid excessive helper text.

---

# 23. Buttons

Button hierarchy:

### Primary

Used for the main action.

```text
[ Upload Document ]
[ Create Workspace ]
[ Save Changes ]
```

### Secondary

Used for supporting actions.

```text
[ Cancel ]
[ Configure ]
```

### Destructive

Used for irreversible actions.

```text
[ Delete Document ]
```

Destructive actions should require confirmation when the action cannot be easily reversed.

---

# 24. Tables

Tables should be used for administrative and document-management data.

Rules:

- Clear column headers
- Compact row height
- Consistent alignment
- Hover state
- Row actions
- Pagination when necessary
- Search/filter for large datasets

Do not use tables for content that is easier to scan as cards.

---

# 25. Empty States

Empty states should explain what the user can do next.

Bad:

```text
No documents.
```

Better:

```text
No documents yet.

Upload company documents to make them available
to your AI workspace.

[ Upload Document ]
```

---

# 26. Loading States

Prefer skeletons for page-level loading.

Use progress indicators for operations with known progress.

For AI generation:

```text
AI is thinking...
```

or a subtle animated indicator.

Avoid large loading spinners that block the entire application.

---

# 27. Error States

Errors should explain:

1. What happened.
2. Whether the user's data is safe.
3. What they can do next.

Example:

```text
Document processing failed

We couldn't process this document.

Your original file is still stored.

[ Retry ]   [ View details ]
```

Technical error details can be available through "View details".

---

# 28. Notifications

Use toast notifications for short-lived feedback.

Examples:

```text
Document uploaded successfully.
Changes saved.
Document processing failed.
```

Do not use toasts for information that must remain visible.

---

# 29. Motion

Motion should be subtle and functional.

Use animation for:

- Opening dialogs
- Expanding panels
- Sidebar transitions
- Message appearance
- Loading/generation states

Avoid:
- decorative floating elements
- excessive bouncing
- large transitions
- unnecessary page animations

Target transition duration:

```text
150–250ms
```

Respect `prefers-reduced-motion`.

---

# 30. Accessibility

Minimum requirements:

- WCAG-oriented contrast
- Keyboard navigation
- Visible focus states
- Semantic HTML
- Accessible labels
- Screen-reader-friendly controls
- Do not rely on color alone
- Dialog focus management
- Logical heading hierarchy

Every interactive element must have an accessible name.

---

# 31. Content / UX Writing

Use concise, human language.

Prefer:

```text
Upload document
```

over:

```text
Initiate document ingestion process
```

Prefer:

```text
Processing document...
```

over:

```text
Document processing pipeline is currently executing
```

The product is technical, but the UI should not unnecessarily sound technical.

---

# 32. Branding

The brand should communicate:

```text
Private
Reliable
Intelligent
Controlled
Professional
```

Avoid visual clichés associated with AI startups.

### Avoid

- neon gradients
- robot illustrations
- glowing brains
- holographic interfaces
- excessive glassmorphism
- giant AI icons

### Prefer

- strong typography
- restrained color
- subtle geometry
- structured layouts
- clear status indicators
- high-quality whitespace
- precise iconography

---

# 33. Component Naming

Use semantic component names.

Recommended:

```text
AppShell
Sidebar
Topbar
ChatLayout
ChatMessage
ChatComposer
SourceList
DocumentTable
DocumentCard
PermissionSelector
StatusBadge
EmptyState
ErrorState
ConfirmDialog
UserMenu
```

Avoid generic names such as:

```text
Box
Thing
Container2
Card2
BluePanel
```

---

# 34. Component States

Every reusable component should consider:

```text
default
hover
focus
active
disabled
loading
error
empty
selected
```

Do not design only the happy path.

---

# 35. Design Tokens

Centralize visual values.

Recommended token categories:

```text
colors
spacing
typography
radius
shadows
transitions
breakpoints
z-index
```

Components should consume tokens rather than hardcoding visual values repeatedly.

---

# 36. Page Templates

The initial product should use a small set of consistent page templates.

## Workspace page

```text
Page header
Description / actions
Main content
```

## List page

```text
Page header
Search / filters / actions
Table or cards
Pagination
```

## Detail page

```text
Back navigation
Header
Metadata
Primary content
Actions
```

## Chat page

```text
Conversation
Sources/context
Composer
```

## Admin page

```text
Admin navigation
Page header
Controls
Data / status
```

---

# 37. Design Priority

When making UI decisions, prioritize in this order:

1. Usability
2. Information hierarchy
3. Accessibility
4. Consistency
5. Performance
6. Visual polish

A visually impressive interface that makes enterprise tasks harder is not considered successful.

---

# 38. Definition of Done — UI

A feature is considered visually complete when:

- It follows the spacing system.
- It uses the defined typography.
- It uses design tokens.
- It has desktop and responsive behavior.
- Hover/focus/disabled states exist.
- Loading and error states exist.
- Empty states exist where relevant.
- Keyboard interaction works.
- Icons follow the icon system.
- It does not introduce a new visual pattern unnecessarily.
- It matches the overall On-Prim AI visual language.

---

# 39. Short Design Summary

**On-Prim AI should look like a serious internal enterprise product.**

Think:

> **Linear's cleanliness + GitHub's credibility + ChatGPT's conversational UX + Notion's information organization.**

But with its own identity:

> **Private Intelligence — Enterprise, Quiet, Secure, Human.**
