import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { NavLink, useMatch, useNavigate } from 'react-router'

import { notify } from '@features/notifications'
import { formatRelative } from '@shared/lib/format'
import { cn } from '@shared/lib/utils'
import { ConfirmDialog } from '@shared/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@shared/ui/dropdown-menu'
import { Input } from '@shared/ui/input'

import { useDeleteConversation, useRenameConversation } from '../api/chat.queries'
import type { Conversation } from '../model/types'

interface ConversationRowProps {
  conversation: Conversation
  /** 'sidebar': compact row in Recents. 'list': roomier row on the Chats page. */
  variant?: 'sidebar' | 'list'
  onNavigate?: () => void
}

/** One conversation with inline rename and delete (sidebar Recents and the Chats page). */
export function ConversationRow({
  conversation,
  variant = 'sidebar',
  onNavigate,
}: ConversationRowProps) {
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const active = useMatch(`/chat/${conversation.id}`) !== null
  const navigate = useNavigate()
  const remove = useDeleteConversation()

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync(conversation.id)
      setDeleting(false)
      notify.success('Conversation deleted')
      if (active) navigate('/chat', { replace: true })
    } catch (error) {
      setDeleting(false)
      notify.apiError(error)
    }
  }

  if (renaming) {
    return (
      <li>
        <RenameForm conversation={conversation} onDone={() => setRenaming(false)} />
      </li>
    )
  }

  const list = variant === 'list'
  return (
    <li className="group relative" data-fit-row={list || undefined}>
      <NavLink
        to={`/chat/${conversation.id}`}
        onClick={onNavigate}
        className={cn(
          'flex flex-col rounded-md ps-3 pe-9 text-sm transition-colors hover:bg-primary-light/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          list ? 'py-3' : 'py-1.5',
          active ? 'bg-primary-light text-primary' : 'text-navy',
        )}
      >
        <span dir="auto" className={cn('truncate', list ? 'font-medium' : 'font-normal')}>
          {conversation.title}
        </span>
        {list && (
          <span className="truncate text-xs text-muted-foreground">
            {conversation.project ? (
              <span className="font-mono">{conversation.project.code} · </span>
            ) : null}
            {conversation.message_count} messages ·{' '}
            {formatRelative(conversation.last_message_at ?? conversation.created_at)}
          </span>
        )}
      </NavLink>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'absolute right-1.5 rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-surface focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:opacity-100',
            list ? 'top-3' : 'top-1',
          )}
          aria-label={`Actions for ${conversation.title}`}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <Pencil aria-hidden />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setDeleting(true)}
            className="text-danger focus:text-danger"
          >
            <Trash2 aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteConversationDialog
        conversation={conversation}
        open={deleting}
        onOpenChange={setDeleting}
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </li>
  )
}

export function RenameForm({
  conversation,
  onDone,
  className,
}: {
  conversation: Conversation
  onDone: () => void
  className?: string
}) {
  const [title, setTitle] = useState(conversation.title)
  const rename = useRenameConversation()

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const clean = title.trim()
    onDone()
    if (!clean || clean === conversation.title) return
    try {
      await rename.mutateAsync({ id: conversation.id, title: clean })
    } catch (error) {
      notify.apiError(error)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className={className ?? 'px-1'}>
      <Input
        dir="auto"
        autoFocus
        aria-label="Conversation title"
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => void submit()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onDone()
        }}
        className="h-8 text-sm"
      />
    </form>
  )
}

export function DeleteConversationDialog({
  conversation,
  open,
  onOpenChange,
  pending,
  onConfirm,
}: {
  conversation: Conversation
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  onConfirm: () => void
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete conversation?"
      description={
        <>
          “<span dir="auto">{conversation.title}</span>” will be removed from your history.
        </>
      }
      confirmLabel="Delete"
      destructive
      pending={pending}
      onConfirm={onConfirm}
    />
  )
}
