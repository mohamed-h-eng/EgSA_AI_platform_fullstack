# Phase 08: Chat UI (3–4 days)

**Goal:** A professional AI workspace UI (design §24–25) on top of phases 06 and 07. Plan §23, §25, and §42.

## Prerequisites
Phases 06 and 07 done.

## Frontend: `features/chat`
```text
features/chat/
├── index.ts                 ← exports manifest, RecentConversations, NewChatButton
├── manifest.ts              ← /chat, /chat/:conversationId ; nav "AI Chat" (chat:use)
├── api/  chat.api.ts  chat.queries.ts  chat.stream.ts (SSE reader via fetch + ReadableStream)
├── pages/ChatPage.tsx       ← 2-pane layout
├── components/
│   ├── ConversationSidebar.tsx   (search, grouped Today/Yesterday/…, New Chat)
│   ├── ConversationItem.tsx      (rename inline, delete w/ confirm)
│   ├── ChatHeader.tsx            (title, project tag, model picker)
│   ├── MessageList.tsx           (auto-scroll, virtualize if long)
│   ├── MessageItem.tsx           (user = subtle blue tint; AI = white, "✦ AI Response" label, markdown + code blocks, copy)
│   ├── ChatComposer.tsx          ("Ask about engineering…", Enter send / Shift+Enter newline, disabled while sending, Stop when streaming)
│   ├── ModelPicker.tsx           (from /ai/models)
│   ├── NewChatDialog.tsx         (optional project via projects' ProjectSelect)
│   └── ChatEmptyState.tsx        (suggested prompts, no claims about document knowledge)
├── hooks/  useSendMessage.ts  useChatStream.ts
└── model/  types.ts  groupByDate.ts
```

- [ ] Conversation list, new chat, open a conversation from history (URL `/chat/:id` restores it).
- [ ] Send → optimistic user message → loading indicator → assistant message.
- [ ] **Error state:** failed assistant message shows an inline error with a **Retry** button. Toast on network failure.
- [ ] **Streaming is the default (D5):** render deltas progressively with a typing cursor, and a Stop button that aborts the fetch. Fall back to the non-streaming endpoint if SSE fails.
- [ ] **Data warning banner (D2):** `components/ChatDataWarning.tsx`, a permanent, non-dismissible amber notice above the composer: "Do not enter classified or sensitive project data. Messages are sent to an external AI provider."
- [ ] **Arabic in chat (D3):** message bodies, the composer textarea, and conversation titles in the sidebar use `dir="auto"`. The Arabic fallback font is applied. Code blocks are forced `dir="ltr"`. Test mixed Arabic and English paragraphs.
- [ ] Rate-limit error (`AI_RATE_LIMITED`) shows the friendly "model busy" message with Retry.
- [ ] Rename and delete conversation.
- [ ] Render markdown safely (e.g. `react-markdown` without raw HTML) with syntax-highlighted code blocks.
- [ ] Keyboard and a11y: focus the composer on load, and give icon buttons `aria-label`s.
- [ ] "New Chat" is reachable from the header or sidebar and the dashboard (exported `NewChatButton`).

## Verification
- Full flow: new chat, ask, get reply, reload page, history intact, rename, delete.
- Several conversations can be switched between without mixing messages.
- OpenRouter failure shows a readable error, and Retry works.
- The UI never says "Based on EgSA Documents".
- The warning banner is always visible in chat.
- Arabic messages render right-aligned and readable, English left-aligned, and code blocks are always left-to-right.
- Component tests: MessageItem variants, groupByDate, composer send/disable behavior.

## Deliverable
Usable AI chat with persistent history.

## Out of scope
Shared conversations, attachments in chat, document grounding and citations.
