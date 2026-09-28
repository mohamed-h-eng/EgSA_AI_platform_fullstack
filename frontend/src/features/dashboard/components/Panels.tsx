import { FileText, FolderKanban, MessageSquareText } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { ProjectStatusBadge, type Project } from '@features/projects'
import { formatRelative } from '@shared/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card'
import { FileTypeIcon } from '@shared/ui/file-type-icon'
import { Skeleton } from '@shared/ui/skeleton'

import type { DashboardConversation, DashboardDocument } from '../model/types'

interface PanelProps {
  title: string
  viewAll?: { to: string; label: string }
  loading: boolean
  empty: ReactNode
  count: number | undefined
  children: ReactNode
}

function Panel({ title, viewAll, loading, empty, count, children }: PanelProps) {
  return (
    <Card className="gap-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {viewAll && (
          <Link to={viewAll.to} className="text-sm font-medium text-primary hover:underline">
            {viewAll.label}
          </Link>
        )}
      </CardHeader>
      <CardContent className="px-2 pt-2">
        {loading ? (
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : count === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">{empty}</div>
        ) : (
          <ul className="flex flex-col">{children}</ul>
        )}
      </CardContent>
    </Card>
  )
}

const rowClass =
  'flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-primary-light/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

export function RecentConversationsPanel({
  items,
  loading,
}: {
  items: DashboardConversation[] | undefined
  loading: boolean
}) {
  return (
    <Panel
      title="Recent conversations"
      viewAll={{ to: '/chat', label: 'Open chat' }}
      loading={loading}
      count={items?.length}
      empty={
        <>
          No conversations yet.{' '}
          <Link to="/chat" className="text-primary underline">
            Ask the assistant
          </Link>
        </>
      }
    >
      {items?.map((c) => (
        <li key={c.id}>
          <Link to={`/chat/${c.id}`} className={rowClass}>
            <MessageSquareText className="size-4 shrink-0 text-ai" aria-hidden />
            <span className="min-w-0 flex-1">
              <span dir="auto" className="block truncate text-sm font-medium text-navy">
                {c.title}
              </span>
              <span className="block text-xs text-muted-foreground">
                {c.project ? `${c.project.code} · ` : ''}
                {formatRelative(c.last_message_at ?? c.created_at)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </Panel>
  )
}

export function RecentDocumentsPanel({
  items,
  loading,
}: {
  items: DashboardDocument[] | undefined
  loading: boolean
}) {
  return (
    <Panel
      title="Recent documents"
      viewAll={{ to: '/documents', label: 'All documents' }}
      loading={loading}
      count={items?.length}
      empty={
        <>
          <FileText className="mx-auto mb-2 size-6" aria-hidden />
          No documents in your projects yet.
        </>
      }
    >
      {items?.map((d) => (
        <li key={d.id}>
          <Link to={`/documents/${d.id}`} className={rowClass}>
            <FileTypeIcon type={d.file_type} />
            <span className="min-w-0 flex-1">
              <span dir="auto" className="block truncate text-sm font-medium text-navy">
                {d.title}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                <span className="font-mono">{d.code}</span> · {d.project.code} ·{' '}
                {formatRelative(d.updated_at)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </Panel>
  )
}

export function MyProjectsPanel({
  items,
  loading,
}: {
  items: Project[] | undefined
  loading: boolean
}) {
  return (
    <Panel
      title="My projects"
      viewAll={{ to: '/projects', label: 'All projects' }}
      loading={loading}
      count={items?.length}
      empty={
        <>
          <FolderKanban className="mx-auto mb-2 size-6" aria-hidden />
          You are not a member of any project yet.
        </>
      }
    >
      {items?.map((p) => (
        <li key={p.id}>
          <Link to={`/projects/${p.id}`} className={rowClass}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-navy">
                <span className="font-mono">{p.code}</span>{' '}
                <span dir="auto" className="font-normal text-muted-foreground">
                  {p.name}
                </span>
              </span>
              <span className="block text-xs text-muted-foreground">
                {p.document_count} documents · {p.member_count} members
              </span>
            </span>
            <ProjectStatusBadge status={p.status} />
          </Link>
        </li>
      ))}
    </Panel>
  )
}
