import { AlertCircle, Check, Clock, Copy, Cpu, Pencil, RotateCcw } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useState } from 'react'

import { copyText } from '@shared/lib/clipboard'
import { formatDateTime } from '@shared/lib/format'
import { cn } from '@shared/lib/utils'
import { Button } from '@shared/ui/button'
import { EgsaLogo } from '@shared/ui/egsa-logo'
import { Textarea } from '@shared/ui/textarea'

import { formatDuration, shortModelName } from '../model/format'
import type { ChatMessage } from '../model/types'
import { MessageMarkdown } from './MessageMarkdown'

interface MessageItemProps {
  message: ChatMessage
  /** AI message: the latest answer can be retried (a new answer replaces it). */
  canRetry?: boolean
  onRetry?: () => void
  /** User message: only the latest one can be edited (its answer is then replaced). */
  canEdit?: boolean
  onEdit?: (content: string) => void
  /** A send/retry/edit is running: actions that change the chat are disabled. */
  busy?: boolean
  /** Display name for a model id (from the admin's allow-list). */
  modelLabel?: (id: string) => string
}

export function MessageItem({
  message,
  canRetry = false,
  onRetry,
  canEdit = false,
  onEdit,
  busy = false,
  modelLabel = shortModelName,
}: MessageItemProps) {
  return message.role === 'user' ? (
    <UserMessage message={message} canEdit={canEdit && !busy} onEdit={onEdit} />
  ) : (
    <AssistantMessage
      message={message}
      canRetry={canRetry}
      onRetry={onRetry}
      busy={busy}
      modelLabel={modelLabel}
    />
  )
}

// ── Shared bits ───────────────────────────────────────────

/** Hover/focus action row. Always visible on touch screens (no hover) and when `pinned`. */
function Actions({
  align,
  pinned = false,
  children,
}: {
  align: 'start' | 'end'
  pinned?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'mt-1 flex min-h-7 flex-wrap items-center gap-1 text-xs text-muted-foreground transition-opacity',
        align === 'end' ? 'justify-end' : 'justify-start',
        !pinned && 'md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100',
      )}
    >
      {children}
    </div>
  )
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs text-muted-foreground hover:text-navy"
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      {label}
    </Button>
  )
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <ActionButton
      label={copied ? 'Copied' : 'Copy'}
      icon={copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      onClick={() =>
        void copyText(text).then((ok) => {
          if (!ok) return
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }
    />
  )
}

// ── User message (right side) ─────────────────────────────

function UserMessage({
  message,
  canEdit,
  onEdit,
}: {
  message: ChatMessage
  canEdit: boolean
  onEdit?: (content: string) => void
}) {
  const [editing, setEditing] = useState(false)

  return (
    <article aria-label="Your message" className="group flex flex-col items-end">
      {editing ? (
        <EditBox
          initial={message.content}
          onCancel={() => setEditing(false)}
          onSave={(content) => {
            setEditing(false)
            onEdit?.(content)
          }}
        />
      ) : (
        <>
          {/* Subtle blue tint for the user (design.md §24); text keeps its own direction. */}
          <div
            dir="auto"
            title={formatDateTime(message.created_at)}
            className="max-w-[85%] rounded-2xl rounded-br-md bg-primary-light px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-navy"
          >
            {message.content}
          </div>
          <Actions align="end">
            <CopyAction text={message.content} />
            {canEdit && onEdit && (
              <ActionButton
                label="Edit"
                icon={<Pencil aria-hidden />}
                onClick={() => setEditing(true)}
              />
            )}
          </Actions>
        </>
      )}
    </article>
  )
}

function EditBox({
  initial,
  onCancel,
  onSave,
}: {
  initial: string
  onCancel: () => void
  onSave: (content: string) => void
}) {
  const [value, setValue] = useState(initial)
  const changed = value.trim().length > 0 && value !== initial

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') onCancel()
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (changed) onSave(value)
    }
  }

  return (
    <div className="w-full max-w-[85%] rounded-2xl border bg-surface p-2 focus-within:border-primary">
      <Textarea
        dir="auto"
        autoFocus
        aria-label="Edit your message"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        className="max-h-60 min-h-16 resize-none border-0 shadow-none focus-visible:ring-0"
      />
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <p className="text-xs text-muted-foreground">The answer below will be replaced.</p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={!changed} onClick={() => onSave(value)}>
            Save &amp; resend
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── AI message (left side) ────────────────────────────────

function AssistantMessage({
  message,
  canRetry,
  onRetry,
  busy,
  modelLabel,
}: {
  message: ChatMessage
  canRetry: boolean
  onRetry?: () => void
  busy: boolean
  modelLabel: (id: string) => string
}) {
  const streaming = message.status === 'streaming'
  const failed = message.status === 'error'
  const stopped = failed && message.error_code === 'STREAM_ABORTED'

  return (
    <article aria-label="AI response" aria-busy={streaming} className="group flex gap-3">
      <EgsaLogo variant="mark" label="" className="mt-0.5 h-6" />
      <div className="min-w-0 flex-1">
        {/* "AI Response", never "Based on EgSA Documents": there is no RAG yet (plan §25). */}
        <p className="mb-1 text-xs font-medium text-ai">✦ AI Response</p>

        {failed && !stopped ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {message.content}
              <span className="mt-1 block text-xs text-danger/80">
                Your message is saved in this conversation.
                {canRetry ? ' You can retry the answer.' : ''}
              </span>
            </span>
          </div>
        ) : (
          <div className="rounded-lg border bg-surface px-4 py-3">
            {message.content ? (
              <MessageMarkdown content={message.content} />
            ) : (
              streaming && <p className="text-sm text-muted-foreground">Thinking…</p>
            )}
            {streaming && (
              <span
                aria-hidden
                className="ms-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-text-bottom"
              />
            )}
            {stopped && <p className="mt-2 text-xs text-muted-foreground">Stopped.</p>}
          </div>
        )}

        {!streaming && (
          // A failed answer keeps Retry visible; otherwise the actions appear on hover.
          <Actions align="start" pinned={failed && !stopped}>
            {!failed && <CopyAction text={message.content} />}
            {canRetry && onRetry && (
              <ActionButton
                label="Retry"
                icon={<RotateCcw aria-hidden />}
                onClick={onRetry}
                disabled={busy}
              />
            )}
            {message.latency_ms != null && (
              <span className="ms-1 inline-flex items-center gap-1" title="Response time">
                <Clock className="size-3.5" aria-hidden />
                <span className="sr-only">Response time</span>
                {formatDuration(message.latency_ms)}
              </span>
            )}
            {message.model && (
              <span className="ms-2 inline-flex items-center gap-1" title={message.model}>
                <Cpu className="size-3.5" aria-hidden />
                Model: {modelLabel(message.model)}
              </span>
            )}
          </Actions>
        )}
      </div>
    </article>
  )
}
