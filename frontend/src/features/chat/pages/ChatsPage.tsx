import { MessageSquareText, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { useDebounce } from '@shared/hooks/useDebounce'
import { useFitRows } from '@shared/hooks/useFitRows'
import { cn } from '@shared/lib/utils'
import { PageHeader } from '@shared/layout/PageHeader'
import { Button } from '@shared/ui/button'
import { Card } from '@shared/ui/card'
import { FormError } from '@shared/ui/form-message'
import { Input } from '@shared/ui/input'
import { PaginationBar } from '@shared/ui/pagination-bar'
import { Skeleton } from '@shared/ui/skeleton'

import { CONVERSATIONS_PAGE_SIZE } from '../api/chat.api'
import { useConversationsPage } from '../api/chat.queries'
import { ConversationRow } from '../components/ConversationRow'
import { groupByDate } from '../model/groupByDate'

/** All chats with search (workflow 11): replaces the search of the old chat sidebar. */
export function ChatsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounce(search.trim())
  // Date-group headings sit between rows: reserve room for up to four of them.
  const { fit, ready, pageSize, attachBody } = useFitRows({
    fallback: CONVERSATIONS_PAGE_SIZE,
    estimate: 64,
    reserve: 4 * 32,
    page,
    onPageChange: setPage,
  })
  const { data, isPending, isError, error, isPlaceholderData } = useConversationsPage(
    q,
    page,
    pageSize,
    ready,
  )

  return (
    <div className={fit ? 'flex h-full min-h-0 flex-col' : undefined}>
      <PageHeader
        title="Chats"
        subtitle="Your conversations with the AI assistant."
        actions={
          <Button asChild>
            <Link to="/chat">New chat</Link>
          </Button>
        }
      />
      <Card className={cn('gap-0 overflow-hidden py-0', fit && 'min-h-0 flex-1')}>
        <div className="border-b p-4">
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              dir="auto"
              placeholder="Search chats…"
              aria-label="Search chats"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>
        </div>

        <div ref={attachBody} className={fit ? 'min-h-0 flex-1 overflow-y-auto' : undefined}>
          {isError ? (
            <div className="p-6">
              <FormError message={error.message} />
            </div>
          ) : isPending ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data.total === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <MessageSquareText className="size-8 text-muted-foreground" aria-hidden />
              <p className="font-medium text-navy">
                {q ? 'No chats match your search.' : 'No chats yet.'}
              </p>
              {!q && (
                <p className="text-sm text-muted-foreground">
                  Start a conversation with the AI assistant.
                </p>
              )}
            </div>
          ) : (
            <div className={isPlaceholderData ? 'p-3 opacity-60 transition-opacity' : 'p-3'}>
              {groupByDate(data.items).map((group) => (
                <section key={group.label} className="mb-3">
                  <h2 className="px-3 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {group.label}
                  </h2>
                  <ul className="flex flex-col">
                    {group.items.map((c) => (
                      <ConversationRow key={c.id} conversation={c} variant="list" />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        {data && data.total > 0 && (
          <PaginationBar
            page={data.page}
            pageSize={pageSize}
            total={data.total}
            onPageChange={setPage}
            noun="chats"
          />
        )}
      </Card>
    </div>
  )
}
