# Phase 11: Unified Sidebar, Claude-style (1–2 days)

**Goal:** One sidebar for the whole app, modeled on the Claude web interface:
- **Top:** fixed actions and main pages.
- **Middle:** the recent chats list.
- **Bottom:** an account menu.

The chat page no longer has its own conversation sidebar. Design decision D18 (below).

## Prerequisites
Phases 08 and 09 done. Read `rules/design-system.md` and `rules/ui-principles.md`.

## Decisions (user, 2026-09-28)

| Question | Decision |
| -------- | -------- |
| Where do admin pages go? | A small **"Administration" group above Recents**, shown only to users with permission. |
| Sidebar tagline ("Space for a Brighter Egypt / PEOPLE, KNOWLEDGE, IMPACT") | **Removed** from the sidebar. |
| Recents list | **Grouped** Today / Yesterday / Previous 7 days / Older (reuse `groupByDate`). |
| Top header bar | **Removed** (Claude style; assumed, since this was the recommended option and not objected to). The product name moves to the sidebar brand block. Each page keeps its own `PageHeader`. |

## Target layout

```text
┌──────────────────────────────┐
│ [EgSA] EgSA AI Engineering   «│  brand (name, 2 lines) + collapse toggle
│        Platform              │
│ ┌──────────────────────────┐ │
│ │ ＋ New chat               │ │  primary button → /chat          (chat:use)
│ └──────────────────────────┘ │
│ 🔍 Search              Ctrl K│  opens the existing GlobalSearch dialog
│ ▢ Dashboard                  │
│ ▢ Chats                      │  /chats: all chats + search      (chat:use)
│ ▢ Projects                   │
│ ▢ Documents                  │
│ ADMINISTRATION               │  small group, only if any item is permitted
│ ▢ Users & Access             │
│ ▢ Admin Settings             │
│ ▢ Audit log                  │
│──────────────────────────────│
│ TODAY                        │  Recents: scrolls independently
│  Battery sizing          ⋯   │  ⋯ → Rename · Delete (confirm)
│ YESTERDAY                    │
│  ما هو اختبار التفريغ…   ⋯   │  dir="auto"
│ PREVIOUS 7 DAYS              │
│  SAR resolution          ⋯   │
│  View all chats →            │
│──────────────────────────────│
│ (MH) Mohamed Hany        ⌃   │  account button → menu opens upward:
└──────────────────────────────┘    name · email · role
                                     Profile & settings · Change password
                                     About (version, AI data notice) · Sign out
```

## Behavior
1. **Top section (fixed, doesn't scroll).**
   - Brand with the product name "EgSA AI Engineering Platform".
   - Collapse toggle, "New chat" button and the search entry.
   - Main navigation from the feature registry (`section: 'main'`), filtered by permission.
   - The Chat nav item "AI Chat" is renamed **"Chats"** and points to the new `/chats` list page.
2. **Administration group.**
   - Items with `section: 'admin'`, compact style (smaller label heading, same row height).
   - The group is hidden when the user has none of them.
3. **Recents (middle, `flex-1 overflow-y-auto`).**
   - The newest 30 conversations, grouped by date, with the open chat highlighted.
   - Each row has a hover/focus ⋯ menu to rename (inline) or delete (with confirmation). Deleting the open chat goes to `/chat`.
   - "View all chats →" links to `/chats`.
   - The list updates on create, auto-title, rename and delete (it already invalidates `['chat','conversations']`).
   - Empty state: "No chats yet".
   - Only rendered for `chat:use`.
4. **Account menu (bottom).**
   - Replaces the header `UserMenu`; it's the same menu, anchored to the sidebar footer and opening upward.
   - Adds an "About" dialog: app name, version, and the D2 notice that chat messages go to an external AI provider.
5. **Collapse.**
   - « collapses to a 64px icon rail on desktop. The state is remembered in `localStorage` (try/catch; default expanded).
   - Tablet (md–lg) defaults to collapsed.
   - When collapsed:
     - Recents and group labels are hidden, and icons get tooltips.
     - New chat and Search become icon buttons.
     - The account button shows the avatar only.
6. **Mobile (< md).**
   - A slim top bar with the menu button and the brand mark (the only header left).
   - The menu opens the **full** sidebar, Recents included, in the left sheet; navigating closes it.
   - This removes the phase-09 limitation that chat history was hidden on phones.
7. **Header removal.**
   - `Header.tsx` goes away on md+.
   - `GlobalSearch` is triggered from the sidebar search entry, and Ctrl+K still works anywhere.
   - `main` keeps its padding variables (`--page-pad-*`).
8. **Chat page becomes a single column.**
   - Remove `ConversationSidebar` from `ChatPage`.
   - The chat top bar keeps the title, project tag and `ModelPicker`, and gains a title dropdown (Rename, Delete).
   - `/chat` still shows `ChatEmptyState` (project select and suggested prompts).
9. **`/chats` page (new, chat feature).**
   - `PageHeader` "Chats", a search box, and the list grouped by date with the same row actions.
   - Paginated (the existing `listConversations` supports `page`).
   - This takes over the search that lived in the old chat sidebar.

## Architecture (keep the boundaries: `shared` never imports `features`)
- **New slot** in `shared/lib/slots.ts`: `sidebarSections: SidebarSection[]` (`{ id, order, permission?, Component }`).
  - The chat feature contributes `RecentChats` through its manifest `slots`, and `app/feature-registry.ts` collects it like `projectTabs`.
- **`shared/layout/Sidebar.tsx`** takes these props:
  - `navItems` (main + admin);
  - `sections` (rendered components between the nav and the footer);
  - `primaryAction` (the New chat button, as a node);
  - `onSearch`;
  - `footer` (the account menu node).
  It owns collapse state and layout only.
- **`app/AuthenticatedShell.tsx`** filters nav, sections and search targets by permission. It passes `<NewChatButton/>` (exported from `@features/chat`) and `<UserMenu placement="sidebar"/>` (from `@features/auth`).
- **Auth feature:** `UserMenu` gets a `variant: 'header' | 'sidebar'` (or is replaced by `AccountMenu`) with an upward menu and an avatar-only compact mode. Add the About dialog here.
- **Chat feature:**
  - Moves `ConversationItem` into `components/ConversationRow.tsx`, shared by `RecentChats` and `ChatsPage`.
  - Deletes `ConversationSidebar.tsx`.
  - Exports `RecentChats` and `NewChatButton`.
- Remove the tagline markup from `SidebarNav`, and the full-bleed negative-margin hack only if the chat page no longer needs it.

## Docs to update in this phase
- `rules/design-system.md`, Layout:
  - The sidebar is Claude-style: brand/actions/nav/Administration, then Recents, then the account menu.
  - There is no top header on desktop.
  - The product name appears in the sidebar brand.
  - Remove the footer tagline rule.
  - Replace "Header shows the exact name…" with "Sidebar brand shows the exact name…".
- `workflows/08-chat-ui.md`: note that `ConversationSidebar` was replaced by phase 11.
- `context/decisions.md`: add **D18: unified Claude-style sidebar** (the table above).
- `progress.md`: add row 11.

## Tests
- Sidebar:
  - Main and admin items are filtered by permission, and Administration is hidden for engineers and viewers.
  - The collapse toggle hides labels and Recents and persists the state.
  - Mobile menu opens a sheet containing Recents.
- RecentChats:
  - Groups by date, highlights the active chat, and renames and deletes.
  - Deleting the active chat navigates to `/chat`.
  - Shows the empty state, and is hidden without `chat:use`.
- Account menu: shows name, email and role, links to profile and password, About shows the D2 notice, and Sign out calls logout.
- Chat page: no conversation sidebar is rendered, and the title dropdown can rename and delete. The existing streaming, Stop and Retry tests stay green.
- `/chats`: search sends `q`, paginates, and has an empty state.
- Update `app/__tests__/permissions-ui.test.tsx` (header search, nav labels) and `features/chat/__tests__/ChatPage.test.tsx`.

## Verification
- Every page renders with the single sidebar. Chat has one column and the history is in the sidebar.
- Keyboard: Tab reaches New chat → Search → nav → Recents rows and their ⋯ menus → account button. Menus close with Esc and return focus.
- Check widths 1440 / 1024 / 768 / 390: expanded, collapsed, rail, drawer.
- The Arabic chat titles render correctly in Recents.
- Run the `checklists/phase-done.md` checks. Rerun `scripts/demo_acceptance.py`; it's API-level, so it should be unaffected.

## Out of scope
- Starred or pinned chats.
- Chat folders.
- Drag-to-reorder.
- Dark mode (backlog B5).
- Per-project chat lists in the sidebar.
