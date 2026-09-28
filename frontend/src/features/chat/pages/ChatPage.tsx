import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Can } from '@features/auth'
import { ApiError } from '@shared/api/http'
import { FormError } from '@shared/ui/form-message'
import { Skeleton } from '@shared/ui/skeleton'

import {
  useChatModels,
  useChatStream,
  useConversation,
  useCreateConversation,
  useMessages,
} from '../api/chat.queries'
import { ChatComposer } from '../components/ChatComposer'
import { ChatDataWarning } from '../components/ChatDataWarning'
import { ChatEmptyState } from '../components/ChatEmptyState'
import { ChatTitleMenu } from '../components/ChatTitleMenu'
import { MessageItem } from '../components/MessageItem'
import { shortModelName } from '../model/format'
import { ModelPicker } from '../components/ModelPicker'

export function ChatPage() {
  const { conversationId = null } = useParams()
  const navigate = useNavigate()
  const { data: models } = useChatModels()
  const [model, setModel] = useState<string | null>(null)
  const [newChatProject, setNewChatProject] = useState<string | null>(null)

  const conversation = useConversation(conversationId)
  const messages = useMessages(conversationId)
  const create = useCreateConversation()
  const stream = useChatStream(conversationId)

  const notConfigured = models !== undefined && !models.configured
  const modelLabel = (id: string) =>
    models?.models.find((m) => m.id === id)?.name ?? shortModelName(id)

  const send = async (content: string) => {
    if (conversationId) {
      await stream.send(content, model)
      return
    }
    // First message of a new chat: create the conversation, open it, then stream into it.
    try {
      const created = await create.mutateAsync({ project_id: newChatProject })
      navigate(`/chat/${created.id}`)
      await stream.send(content, model, created.id)
    } catch (error) {
      stream.clearError()
      throw error
    }
  }

  return (
    // Cancel the shell's padding: the chat workspace fills the whole content area.
    <div
      className="flex min-h-[28rem]"
      style={{
        margin: 'calc(-1 * var(--page-pad-y)) calc(-1 * var(--page-pad-x))',
        height: 'calc(100% + 2 * var(--page-pad-y))',
      }}
    >
      <section className="flex min-w-0 flex-1 flex-col bg-background" aria-label="Chat">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-surface px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {conversation.data ? (
              <ChatTitleMenu key={conversation.data.id} conversation={conversation.data} />
            ) : (
              <h2 className="truncate px-2 text-base font-semibold">
                {conversationId ? '…' : 'New conversation'}
              </h2>
            )}
            {conversation.data?.project && (
              <Link
                to={`/projects/${conversation.data.project.id}`}
                className="shrink-0 rounded-md bg-primary-light px-2 py-0.5 font-mono text-xs font-medium text-primary hover:underline"
              >
                {conversation.data.project.code}
              </Link>
            )}
          </div>
          <ModelPicker models={models} value={model} onChange={setModel} disabled={stream.busy} />
        </header>

        {conversationId && conversation.isError ? (
          <NotFound error={conversation.error} />
        ) : conversationId ? (
          <MessageList
            loading={messages.isPending}
            messages={messages.data ?? []}
            onRetry={() => void stream.retry(model)}
            onEdit={(messageId, content) => void stream.edit(messageId, content, model)}
            busy={stream.busy}
            modelLabel={modelLabel}
          />
        ) : (
          <ChatEmptyState
            projectId={newChatProject}
            onProjectChange={setNewChatProject}
            onSuggestion={(text) => void send(text)}
            disabled={stream.busy || create.isPending || notConfigured}
          />
        )}

        <footer className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-2 px-6 pt-2 pb-4">
          {notConfigured && (
            <p
              role="status"
              className="rounded-md bg-surface-muted px-3 py-2 text-sm text-muted-foreground"
            >
              The AI model hasn't been set up yet.{' '}
              <Can
                permission="settings:manage"
                fallback={<>Ask an administrator to configure it.</>}
              >
                <Link to="/admin/settings" className="text-primary underline">
                  Configure it in Admin Settings
                </Link>
                .
              </Can>
            </p>
          )}
          <FormError message={stream.error ?? (create.error ? errorText(create.error) : null)} />
          <ChatDataWarning />
          <ChatComposer
            onSend={(content) => void send(content)}
            onStop={stream.stop}
            busy={stream.busy || create.isPending}
            streaming={stream.phase === 'streaming'}
            disabled={notConfigured || (conversationId !== null && conversation.isError)}
            disabledReason={
              notConfigured
                ? "The AI model isn't configured yet."
                : 'This conversation is unavailable.'
            }
          />
        </footer>
      </section>
    </div>
  )
}

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong.'
}

function NotFound({ error }: { error: unknown }) {
  const notFound = error instanceof ApiError && error.status === 404
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="font-medium text-navy">
        {notFound ? 'Conversation not found' : 'Could not load the conversation'}
      </p>
      <Link to="/chat" className="text-sm text-primary underline">
        Start a new chat
      </Link>
    </div>
  )
}

interface MessageListProps {
  loading: boolean
  messages: ReturnType<typeof useMessages>['data'] & object
  onRetry: () => void
  onEdit: (messageId: string, content: string) => void
  busy: boolean
  modelLabel: (id: string) => string
}

function MessageList({ loading, messages, onRetry, onEdit, busy, modelLabel }: MessageListProps) {
  // Only the newest answer can be retried and only your newest message edited (no branches).
  const last = messages.at(-1)
  const lastAssistantId = last?.role === 'assistant' ? last.id : undefined
  const lastUserId = messages.findLast((m) => m.role === 'user')?.id
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const lastContent = messages.at(-1)?.content.length ?? 0

  // Follow the answer while it streams, unless the user scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [messages.length, lastContent])

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        const el = e.currentTarget
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
      }}
      className="flex-1 overflow-y-auto"
      role="log"
      aria-live="polite"
      aria-label="Messages"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-6">
        {loading ? (
          <>
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Send a message to start the conversation.
          </p>
        ) : (
          messages.map((m) => (
            <MessageItem
              key={m.id}
              message={m}
              canRetry={m.id === lastAssistantId}
              onRetry={onRetry}
              canEdit={m.id === lastUserId}
              onEdit={(content) => onEdit(m.id, content)}
              busy={busy}
              modelLabel={modelLabel}
            />
          ))
        )}
      </div>
    </div>
  )
}
