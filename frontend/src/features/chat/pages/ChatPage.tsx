import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Can, useAuth } from '@features/auth'
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
import { ConversationSidebar } from '../components/ConversationSidebar'
import { MessageItem } from '../components/MessageItem'
import { ModelPicker } from '../components/ModelPicker'

export function ChatPage() {
  const { conversationId = null } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: models } = useChatModels()
  const [model, setModel] = useState<string | null>(null)
  const [newChatProject, setNewChatProject] = useState<string | null>(null)

  const conversation = useConversation(conversationId)
  const messages = useMessages(conversationId)
  const create = useCreateConversation()
  const stream = useChatStream(conversationId)

  const notConfigured = models !== undefined && !models.configured
  const lastMessage = messages.data?.at(-1)

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
      <ConversationSidebar activeId={conversationId} />

      <section className="flex min-w-0 flex-1 flex-col bg-background" aria-label="Chat">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-surface px-6">
          <div className="flex min-w-0 items-center gap-3">
            <h2 dir="auto" className="truncate text-base font-semibold">
              {conversationId ? (conversation.data?.title ?? '…') : 'New conversation'}
            </h2>
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
            userName={user?.full_name ?? 'You'}
            lastMessageId={lastMessage?.id}
            onRetry={() => void stream.retry(model)}
            retrying={stream.busy}
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
            disabledReason="The AI model isn't configured yet."
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
  userName: string
  lastMessageId: string | undefined
  onRetry: () => void
  retrying: boolean
}

function MessageList({
  loading,
  messages,
  userName,
  lastMessageId,
  onRetry,
  retrying,
}: MessageListProps) {
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
              userName={userName}
              canRetry={m.id === lastMessageId}
              onRetry={onRetry}
              retrying={retrying}
            />
          ))
        )}
      </div>
    </div>
  )
}
