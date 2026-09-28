import { ScrollText, Search } from 'lucide-react'
import { Fragment, useState } from 'react'

import { useDebounce } from '@shared/hooks/useDebounce'
import { formatDateTime } from '@shared/lib/format'
import { PageHeader } from '@shared/layout/PageHeader'
import { Button } from '@shared/ui/button'
import { Card } from '@shared/ui/card'
import { FormError } from '@shared/ui/form-message'
import { Input } from '@shared/ui/input'
import { PaginationBar } from '@shared/ui/pagination-bar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { Skeleton } from '@shared/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table'

import { AUDIT_PAGE_SIZE } from '../api/audit.api'
import { useAuditActions, useAuditLogs } from '../api/audit.queries'
import { type AuditEntry, actionLabel } from '../model/types'

const ALL = 'all'

/** Read-only audit trail for administrators (plan §28). */
export function AuditLogPage() {
  const [actor, setActor] = useState('')
  const [action, setAction] = useState(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)

  const debouncedActor = useDebounce(actor)
  const { data: actions = [] } = useAuditActions()
  const areas = [...new Set(actions.map((a) => a.split('.')[0]))]
  const { data, isPending, isError, error, isPlaceholderData } = useAuditLogs({
    actor: debouncedActor,
    action: action === ALL ? '' : action,
    from,
    to,
    page,
  })

  const filtered = !!(actor || from || to) || action !== ALL
  const withReset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setPage(1)
    }

  return (
    <>
      <PageHeader title="Audit log" subtitle="Who did what, and when. Newest first." />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-end gap-3 border-b p-4">
          <div className="relative min-w-56 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Filter by user name or email…"
              aria-label="Filter by user"
              value={actor}
              onChange={(e) => withReset(setActor)(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={action} onValueChange={withReset(setAction)}>
            <SelectTrigger className="w-56" aria-label="Filter by action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All actions</SelectItem>
              {areas.map((area) => (
                <Fragment key={area}>
                  <SelectItem value={area}>All {area} actions</SelectItem>
                  {actions
                    .filter((a) => a.startsWith(`${area}.`))
                    .map((a) => (
                      <SelectItem key={a} value={a} className="pl-6">
                        {actionLabel(a)}
                      </SelectItem>
                    ))}
                </Fragment>
              ))}
            </SelectContent>
          </Select>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            From
            <Input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => withReset(setFrom)(e.target.value)}
              className="w-40"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            To
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => withReset(setTo)(e.target.value)}
              className="w-40"
            />
          </label>
          {filtered && (
            <Button
              variant="ghost"
              onClick={() => {
                setActor('')
                setAction(ALL)
                setFrom('')
                setTo('')
                setPage(1)
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {isError ? (
          <div className="p-6">
            <FormError message={error.message} />
          </div>
        ) : data && data.total === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <ScrollText className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium text-navy">
              {filtered ? 'No events match these filters.' : 'No events recorded yet.'}
            </p>
          </div>
        ) : (
          <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-muted hover:bg-surface-muted">
                  <TableHead className="pl-4">When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="hidden md:table-cell">Target</TableHead>
                  <TableHead className="hidden lg:table-cell">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending
                  ? Array.from({ length: 6 }, (_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={5} className="pl-4">
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : data?.items.map((entry) => (
                      <AuditRow
                        key={entry.id}
                        entry={entry}
                        expanded={expanded === entry.id}
                        onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
                      />
                    ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data && data.total > 0 && (
          <PaginationBar
            page={data.page}
            pageSize={AUDIT_PAGE_SIZE}
            total={data.total}
            onPageChange={setPage}
            noun="events"
          />
        )}
      </Card>
    </>
  )
}

function AuditRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: AuditEntry
  expanded: boolean
  onToggle: () => void
}) {
  const hasDetails = Object.keys(entry.meta).length > 0
  return (
    <>
      <TableRow>
        <TableCell className="pl-4 whitespace-nowrap text-muted-foreground">
          {formatDateTime(entry.created_at)}
        </TableCell>
        <TableCell>
          {entry.actor ? (
            <>
              <span dir="auto" className="block font-medium text-navy">
                {entry.actor.full_name}
              </span>
              <span className="block text-xs text-muted-foreground">{entry.actor.email}</span>
            </>
          ) : (
            <span className="text-muted-foreground">System / unknown</span>
          )}
        </TableCell>
        <TableCell>
          <span className="font-medium">{actionLabel(entry.action)}</span>
          {hasDetails && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              className="ms-2 text-xs text-primary underline-offset-2 hover:underline"
            >
              {expanded ? 'Hide details' : 'Details'}
            </button>
          )}
        </TableCell>
        <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
          {entry.target_type ? `${entry.target_type} ${entry.target_id?.slice(0, 8) ?? ''}` : '—'}
        </TableCell>
        <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
          {entry.ip ?? '—'}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-surface-muted/50 hover:bg-surface-muted/50">
          <TableCell colSpan={5} className="pl-4">
            <pre dir="ltr" className="overflow-x-auto text-xs whitespace-pre-wrap text-navy">
              {JSON.stringify(entry.meta, null, 2)}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
