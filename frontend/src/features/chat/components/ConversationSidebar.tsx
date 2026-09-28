import { MessageSquarePlus, MoreHorizontal, Pencil, Search, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { NavLink, useNavigate } from 'react-router'

import { notify } from '@features/notifications'
import { useDebounce } from '@shared/hooks/useDebounce'
import { cn } from '@shared/lib/utils'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@shared/ui/dropdown-menu'
import { Input } from '@shared/ui/input'
import { Skeleton } from '@shared/ui/skeleton'

import { useConversations, useDeleteConversation, useRenameConversation } from '../api/chat.queries'
import { groupByDate } from '../model/groupByDate'
import type { Conversation } from '../model/types'

export function ConversationSidebar({ activeId }: { activeId: string | null }) {
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim())
  const { data: conversations, isPending, isError } = useConversations(q)
  const navigate = useNavigate()

  return (
    <aside className="flex w-72 shrink-0 flex-col border-e bg-surface" aria-label="Conversations">
      <div className="flex flex-col gap-3 border-b p-4">
        <Button onClick={() => navigate('/chat')} className="w-full">
          <MessageSquarePlus aria-hidden />
          New chat
        </Button>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            dir="auto"
            placeholder="Search conversations…"
            aria-label="Search conversations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2" aria-label="Conversation history">
        {isPending ? (
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p className="p-3 text-sm text-danger">Could not load conversations.</p>
        ) : conversations.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            {q ? 'No conversations match.' : 'No conversations yet.'}
          </p>
        ) : (
          groupByDate(conversations).map((group) => (
            <section key={group.label} className="mb-3">
              <h3 className="px-3 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
              </h3>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((c) => (
                  <ConversationItem key={c.id} conversation={c} active={c.id === activeId} />
                ))}
              </ul>
            </section>
          ))
        )}
      </nav>
    </aside>
  )
}

function ConversationItem({
  conversation,
  active,
}: {
  conversation: Conversation
  active: boolean
}) {
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(conversation.title)
  const [deleting, setDeleting] = useState(false)
  const rename = useRenameConversation()
  const remove = useDeleteConversation()
  const navigate = useNavigate()

  const submitRename = async (e?: FormEvent) => {
    e?.preventDefault()
    const clean = title.trim()
    setRenaming(false)
    if (!clean || clean === conversation.title) {
      setTitle(conversation.title)
      return
    }
    try {
      await rename.mutateAsync({ id: conversation.id, title: clean })
    } catch (error) {
      setTitle(conversation.title)
      notify.apiError(error)
    }
  }

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
        <form onSubmit={(e) => void submitRename(e)} className="px-1">
          <Input
            dir="auto"
            autoFocus
            aria-label="Conversation title"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void submitRename()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setTitle(conversation.title)
                setRenaming(false)
              }
            }}
            className="h-8 text-sm"
          />
        </form>
      </li>
    )
  }

  return (
    <li className="group relative">
      <NavLink
        to={`/chat/${conversation.id}`}
        className={cn(
          'flex flex-col rounded-md py-2 ps-3 pe-9 text-sm transition-colors hover:bg-primary-light/60',
          active ? 'bg-primary-light text-primary' : 'text-navy',
        )}
      >
        <span dir="auto" className="truncate font-medium">
          {conversation.title}
        </span>
        {conversation.project && (
          <span className="truncate font-mono text-xs text-muted-foreground">
            {conversation.project.code}
          </span>
        )}
      </NavLink>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="absolute top-1.5 right-1.5 rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-surface focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:opacity-100"
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
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete conversation?"
        description={
          <>
            “<span dir="auto">{conversation.title}</span>” will be removed from your history.
          </>
        }
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </li>
  )
}
