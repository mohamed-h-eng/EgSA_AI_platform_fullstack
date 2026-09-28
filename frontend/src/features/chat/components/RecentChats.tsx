import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { Skeleton } from '@shared/ui/skeleton'

import { useConversations } from '../api/chat.queries'
import { groupByDate } from '../model/groupByDate'
import { ConversationRow } from './ConversationRow'

export const RECENT_LIMIT = 30

/** Sidebar "Recents" (workflow 11): newest conversations grouped by date. */
export function RecentChats({ onNavigate }: { onNavigate?: () => void }) {
  const { data, isPending, isError } = useConversations('')
  const recent = data?.slice(0, RECENT_LIMIT) ?? []

  return (
    <section aria-label="Recent chats" className="flex flex-col gap-3">
      {isPending ? (
        <div className="flex flex-col gap-2 px-1">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="px-3 text-xs text-danger">Could not load chats.</p>
      ) : recent.length === 0 ? (
        <p className="px-3 text-xs text-muted-foreground">No chats yet.</p>
      ) : (
        <>
          {groupByDate(recent).map((group) => (
            <div key={group.label}>
              <h3 className="mb-1 px-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                {group.label}
              </h3>
              <ul className="flex flex-col">
                {group.items.map((c) => (
                  <ConversationRow key={c.id} conversation={c} onNavigate={onNavigate} />
                ))}
              </ul>
            </div>
          ))}
          <Link
            to="/chats"
            onClick={onNavigate}
            className="flex items-center gap-1 px-3 text-xs font-medium text-primary hover:underline"
          >
            View all chats
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        </>
      )}
    </section>
  )
}
