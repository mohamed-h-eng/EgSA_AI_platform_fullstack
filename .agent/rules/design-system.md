# Design System: Implementation Rules

Condensed from `../../design.md` (EgSA brand). General UI practice comes from
[`ui-principles.md`](ui-principles.md); where they conflict, this file and the D-decisions win.

## Tokens → Tailwind theme

Put the tokens in `frontend/src/styles/tokens.css` as CSS variables and map them in `tailwind.config.ts`:

```text
primary #1769E0 · primary-dark #102A72 · navy #0B1F5B · primary-light #EAF3FF
background #F7F9FC · surface #FFFFFF · surface-muted #F3F6FA · border #E5EAF1 · input-border #DCE3EC
success #16A36A · warning #E6A23C · danger #E5484D · ai #7657E8
radius: sm 6 · md 8 (inputs, buttons) · lg 10 (cards) · xl 14 · pill 999 (status, tags only)
space: 4 · 8 · 12 · 16 · 24 · 32 · 48
font: Inter (UI) · Arabic fallback "IBM Plex Sans Arabic" or "Noto Sans Arabic", all self-hosted (D1, D3)
     font-family: Inter, "IBM Plex Sans Arabic", system-ui, sans-serif
motion: 150–250ms, subtle only; honor prefers-reduced-motion
type: page H1 24px/600 · H2 20 · H3 16 · body 14 · small 13 · caption 12 (hero title may be larger)
surfaces: borders, not shadows. Shadows only on floating UI (dialogs, menus, popovers) plus the
     hero banner and chat composer
```

## Shared UI kit (`shared/ui`, shadcn/ui-based (D6), built in Phase 01/02, grows as needed)

Button (primary / secondary / ai / danger / ghost) · Input · SearchBar (Ctrl+K hint) · Card · StatCard ·
Badge (status pill) · FileTypeIcon (PDF red, DOCX blue, XLSX green, TXT gray) · Avatar (initials) ·
Table (light header, hover, pagination) · Tabs (blue underline) · Modal · Drawer (right detail panel) ·
EmptyState · ErrorState · Spinner/Skeleton · Toast

## Layout (`shared/layout`)

- **AppShell (D18):** one Claude-style sidebar (256px, 64px icon rail when collapsed) + content with 24–32px padding. No top header on desktop; phones get a slim bar with a menu button that opens the full sidebar in a drawer.
- **Sidebar (D18):** top = static EgSA logo (`shared/ui/egsa-logo`, `mark` variant) + **"EgSA AI Platform"** + collapse toggle, **New chat** (a plus in a filled blue circle + label; hover/focus restyle only the circle so it never looks like an active tab), then Dashboard > Projects > Documents, then a small **Administration** group (permission-filtered; collapsed by default, opens itself on admin pages, remembers when opened; always shown as icons in the rail). No Chats item and no visible Search entry (all chats via "View all chats"; Ctrl+K still opens search). Middle = feature sections via the `sidebarSections` slot (Recents, grouped Today / Yesterday / Previous 7 days / Older), scrolling on their own. Bottom = account menu (opens upward, same width as the account button so it stays inside the sidebar). The active item gets a light-blue background with blue icon and text. No tagline. Feature pages never add a second sidebar.
- **PageHeader:** optional breadcrumb, then title (24px/600 navy), then subtitle (14px muted).
- **HeroBanner:** rounded 16px, text on the left and the animated EgSA logo on the right. Used on the dashboard and major sections only.
- **Responsive:** desktop first. On tablet the sidebar collapses. On mobile, use a top header, drawer navigation, and a single column.

## Product rules

- **EgSA logo** (`shared/ui/egsa-logo.tsx`, canvas, user-supplied 2026-09-28): the `full` variant, animated and in white ink, sits on the right of the dashboard hero; the static `mark` variant is used in the sidebar brand and as the AI-message avatar. The sidebar brand reads **"EgSA AI Platform"**; the full product name stays on the login page and About.
- Most surfaces should be white, light gray, navy, and blue. Use purple **only** for AI accents (✦ icon, AI badges, model config).
- The chat reads as a professional workspace (history lives in the app sidebar, D18). **User messages sit on the right** in a subtle blue-tinted bubble (max 85% width); **AI messages on the left** in white with the "✦ AI Response" label. Actions appear on hover/focus (always visible on touch screens): user → Copy, Edit (latest message only; replaces the answer after it); AI → Copy, Retry (latest answer only; a new answer replaces it), response time (e.g. "2.4s"), and "Model: <name>" (the admin's display name, else the short model id). A failed answer keeps Retry visible.
- AI answers are labeled **"AI Response"** (there is no RAG yet).
- **Chat data warning (D2):** a slim, non-dismissible amber notice above the composer reads "Do not enter classified or sensitive project data. Messages are sent to an external AI provider." Use amber, not red, so it informs without alarming.
- **Mixed-direction chat (D3):** each message body uses `dir="auto"`. Arabic paragraphs align right, and code blocks always stay left-to-right. Layout chrome (avatars, labels, timestamps) stays left-to-right.
- Errors say what happened, whether the user's data is safe, and what to do next (e.g. "Your message is saved… You can retry").
- **Full-page tables** (Users & Access, Documents, Audit log, Chats): the table card fills the rest of the page and rows per page = what fits (`shared/hooks/useFitRows`, rows marked `data-fit-row`), so the table never scrolls; resizing recalculates and keeps the first visible record. With few records the card still reaches the page bottom and the count/pagination bar stays pinned there. Phones and short windows (< 768px wide or < 560px tall) scroll normally with the standard page size. Tables embedded in other pages (project Documents tab, Members, dashboard AI usage) keep their natural height.
- The UI is light-only for now; dark mode is backlog B5.
- Accessibility: visible focus rings, labels on icon-only buttons, and status shown by text as well as color. Everything must be keyboard navigable.
- Don't use neon, glassmorphism, cyberpunk styling, robot imagery, mixed icon sets, or heavy shadows.
