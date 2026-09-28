import { Search, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'

import { Can } from '@features/auth'
import { useDebounce } from '@shared/hooks/useDebounce'
import { useFitRows } from '@shared/hooks/useFitRows'
import { cn } from '@shared/lib/utils'
import { PageHeader } from '@shared/layout/PageHeader'
import { Button } from '@shared/ui/button'
import { Card } from '@shared/ui/card'
import { FormError } from '@shared/ui/form-message'
import { Input } from '@shared/ui/input'
import { PaginationBar } from '@shared/ui/pagination-bar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'

import { USERS_PAGE_SIZE } from '../api/users.api'
import { useRoles, useUsers } from '../api/users.queries'
import { CreateUserDialog } from '../components/CreateUserDialog'
import { UserDrawer } from '../components/UserDrawer'
import { UsersTable } from '../components/UsersTable'
import { STATUS_META, type UserStatus } from '../model/types'

const ALL = 'all'

export function UsersPage() {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState(ALL)
  const [status, setStatus] = useState<UserStatus | typeof ALL>(ALL)
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const q = useDebounce(search)
  const { fit, ready, pageSize, attachBody } = useFitRows({
    fallback: USERS_PAGE_SIZE,
    page,
    onPageChange: setPage,
  })
  const { data: roles = [] } = useRoles()
  const { data, isPending, isError, error, isPlaceholderData } = useUsers(
    {
      q,
      role: role === ALL ? '' : role,
      status: status === ALL ? '' : status,
      page,
      pageSize,
    },
    ready,
  )

  const filtered = !!q || role !== ALL || status !== ALL
  const resetPage =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setPage(1)
    }

  return (
    <div className={fit ? 'flex h-full min-h-0 flex-col' : undefined}>
      <PageHeader
        title="Users & Access"
        subtitle="Manage platform accounts, roles and access."
        actions={
          <Can permission="users:create">
            <Button onClick={() => setCreating(true)}>
              <UserPlus aria-hidden />
              Add user
            </Button>
          </Can>
        }
      />

      <Card className={cn('gap-0 overflow-hidden py-0', fit && 'min-h-0 flex-1')}>
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-60 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              dir="auto"
              placeholder="Search by name or email…"
              aria-label="Search users"
              value={search}
              onChange={(e) => resetPage(setSearch)(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={role} onValueChange={resetPage(setRole)}>
            <SelectTrigger className="w-44" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All roles</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.code} value={r.code}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => resetPage(setStatus)(v as UserStatus | typeof ALL)}
          >
            <SelectTrigger className="w-48" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {(Object.keys(STATUS_META) as UserStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div ref={attachBody} className={fit ? 'min-h-0 flex-1 overflow-y-auto' : undefined}>
          {isError ? (
            <div className="p-6">
              <FormError message={error.message} />
            </div>
          ) : data && data.total === 0 ? (
            <EmptyState filtered={filtered} />
          ) : (
            <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
              <UsersTable
                users={data?.items}
                loading={isPending}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          )}
        </div>

        {data && data.total > 0 && (
          <PaginationBar
            page={data.page}
            pageSize={pageSize}
            total={data.total}
            onPageChange={setPage}
            noun="users"
          />
        )}
      </Card>

      <UserDrawer userId={selectedId} onClose={() => setSelectedId(null)} />
      <CreateUserDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <Users className="size-10 text-muted-foreground/60" aria-hidden />
      <p className="font-medium text-navy">
        {filtered ? 'No users match your filters' : 'No users yet'}
      </p>
      <p className="text-sm text-muted-foreground">
        {filtered
          ? 'Try a different search or clear the filters.'
          : 'Add the first user to get started.'}
      </p>
    </div>
  )
}
