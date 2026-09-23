# Design System: Implementation Rules

Condensed from `../../design.md`. Read the full document when building a new screen.

## Tokens → Tailwind theme

Put the tokens in `frontend/src/styles/tokens.css` as CSS variables and map them in `tailwind.config.ts`:

```text
primary #1769E0 · primary-dark #102A72 · navy #0B1F5B · primary-light #EAF3FF
background #F7F9FC · surface #FFFFFF · surface-muted #F3F6FA · border #E5EAF1 · input-border #DCE3EC
success #16A36A · warning #E6A23C · danger #E5484D · ai #7657E8
radius: sm 8 · md 12 · lg 16 · pill 999
space: 4 · 8 · 12 · 16 · 24 · 32 · 48
font: Inter (UI) · Arabic fallback "IBM Plex Sans Arabic" or "Noto Sans Arabic", all self-hosted (D1, D3)
     font-family: Inter, "IBM Plex Sans Arabic", system-ui, sans-serif
motion: 150–250ms, subtle only
```

## Shared UI kit (`shared/ui`, shadcn/ui-based (D6), built in Phase 01/02, grows as needed)

Button (primary / secondary / ai / danger / ghost) · Input · SearchBar (Ctrl+K hint) · Card · StatCard ·
Badge (status pill) · FileTypeIcon (PDF red, DOCX blue, XLSX green, TXT gray) · Avatar (initials) ·
Table (light header, hover, pagination) · Tabs (blue underline) · Modal · Drawer (right detail panel) ·
EmptyState · ErrorState · Spinner/Skeleton · Toast

## Layout (`shared/layout`)

- **AppShell:** Sidebar (220–250px) + Header + content with 24–32px padding.
- **Sidebar:** EgSA logo at top ("Egyptian Space Agency"). Nav items come from the feature registry. The active item gets a light-blue background with blue icon and text. Footer tagline: "Space for a Brighter Egypt / PEOPLE | KNOWLEDGE | IMPACT".
- **PageHeader:** optional breadcrumb, then title (32–40px/700 navy), then subtitle (14–18px muted).
- **HeroBanner:** rounded 16px, text on the left and satellite/Earth image on the right. Used on the dashboard and major sections only.
- **Responsive:** desktop first. On tablet the sidebar collapses. On mobile, use a top header, drawer navigation, and a single column.

## Product rules

- Header shows the exact name **"EgSA AI Engineering Platform"**.
- Most surfaces should be white, light gray, navy, and blue. Use purple **only** for AI accents (✦ icon, AI badges, model config).
- The chat reads as a professional workspace: conversation sidebar plus main area. User messages use a subtle blue tint and AI messages use white. Avoid large bubbles.
- AI answers are labeled **"AI Response"** (there is no RAG yet).
- **Chat data warning (D2):** a slim, non-dismissible amber notice above the composer reads "Do not enter classified or sensitive project data. Messages are sent to an external AI provider." Use amber, not red, so it informs without alarming.
- **Mixed-direction chat (D3):** each message body uses `dir="auto"`. Arabic paragraphs align right, and code blocks always stay left-to-right. Layout chrome (avatars, labels, timestamps) stays left-to-right.
- Accessibility: visible focus rings, labels on icon-only buttons, and status shown by text as well as color. Everything must be keyboard navigable.
- Don't use neon, glassmorphism, cyberpunk styling, robot imagery, mixed icon sets, or heavy shadows.
