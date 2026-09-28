import { ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { notify } from '@features/notifications'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@shared/ui/dropdown-menu'

import { useDeleteConversation } from '../api/chat.queries'
import type { Conversation } from '../model/types'
import { DeleteConversationDialog, RenameForm } from './ConversationRow'

/** Chat top bar title: click for Rename / Delete (Claude-style; the history lives in the sidebar). */
export function ChatTitleMenu({ conversation }: { conversation: Conversation }) {
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const remove = useDeleteConversation()
  const navigate = useNavigate()

  if (renaming) {
    return (
      <RenameForm
        conversation={conversation}
        onDone={() => setRenaming(false)}
        className="w-72 max-w-full"
      />
    )
  }

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync(conversation.id)
      setDeleting(false)
      notify.success('Conversation deleted')
      navigate('/chat', { replace: true })
    } catch (error) {
      setDeleting(false)
      notify.apiError(error)
    }
  }

  return (
    <>
      <h2 className="min-w-0 text-base font-semibold">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex max-w-full items-center gap-1 rounded-md px-2 py-1 hover:bg-primary-light/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={`${conversation.title}: conversation options`}
          >
            <span dir="auto" className="truncate">
              {conversation.title}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
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
      </h2>
      <DeleteConversationDialog
        conversation={conversation}
        open={deleting}
        onOpenChange={setDeleting}
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
