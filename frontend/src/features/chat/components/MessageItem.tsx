import { AlertCircle, Check, Copy, RotateCcw, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { copyText } from '@shared/lib/clipboard'
import { formatRelative } from '@shared/lib/format'
import { initials } from '@shared/lib/initials'
import { cn } from '@shared/lib/utils'
import { Avatar, AvatarFallback } from '@shared/ui/avatar'
import { Button } from '@shared/ui/button'

import type { ChatMessage } from '../model/types'
import { MessageMarkdown } from './MessageMarkdown'

interface MessageItemProps {
  message: ChatMessage
  userName: string
  /** Only the latest failed reply can be retried. */
  canRetry: boolean
  onRetry: () => void
  retrying: boolean
}

export function MessageItem({ message, userName, canRetry, onRetry, retrying }: MessageItemProps) {
  return message.role === 'user' ? (
    <UserMessage message={message} userName={userName} />
  ) : (
    <AssistantMessage message={message} canRetry={canRetry} onRetry={onRetry} retrying={retrying} />
  )
}

function UserMessage({ message, userName }: { message: ChatMessage; userName: string }) {
  return (
    <article aria-label="Your message" className="flex gap-3">
      <Avatar className="mt-0.5 size-8">
        <AvatarFallback className="bg-primary-light text-xs font-semibold text-primary">
          {initials(userName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          You <span className="font-normal">· {formatRelative(message.created_at)}</span>
        </p>
        {/* Subtle blue tint for the user (design.md §24); text keeps its own direction. */}
        <div
          dir="auto"
          className="rounded-lg bg-primary-light/60 px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-navy"
        >
          {message.content}
        </div>
      </div>
    </article>
  )
}

function AssistantMessage({
  message,
  canRetry,
  onRetry,
  retrying,
}: {
  message: ChatMessage
  canRetry: boolean
  onRetry: () => void
  retrying: boolean
}) {
  const [copied, setCopied] = useState(false)
  const streaming = message.status === 'streaming'
  const failed = message.status === 'error'
  const stopped = failed && message.error_code === 'STREAM_ABORTED'

  const copy = async () => {
    if (await copyText(message.content)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <article aria-label="AI response" aria-busy={streaming} className="flex gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-ai/10 text-ai">
        <Sparkles className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {/* "AI Response", never "Based on EgSA Documents": there is no RAG yet (plan §25). */}
          <span className="text-ai">✦ AI Response</span>
          {message.model && <span className="font-mono font-normal">{message.model}</span>}
        </p>

        {failed && !stopped ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{message.content}</span>
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
          <div className="mt-1.5 flex items-center gap-1">
            {!failed && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => void copy()}
              >
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            )}
            {failed && canRetry && (
              <Button
                variant="outline"
                size="sm"
                className={cn('h-7 px-2 text-xs')}
                onClick={onRetry}
                disabled={retrying}
              >
                <RotateCcw aria-hidden />
                Retry
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
