import { formatRelative } from '@shared/lib/format'
import { initials } from '@shared/lib/initials'
import { cn } from '@shared/lib/utils'
import { Avatar, AvatarFallback } from '@shared/ui/avatar'
import { Skeleton } from '@shared/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table'

import { type ManagedUser, primaryRole } from '../model/types'
import { UserStatusBadge } from './UserStatusBadge'

interface UsersTableProps {
  users: ManagedUser[] | undefined
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}

export function UsersTable({ users, loading, selectedId, onSelect }: UsersTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-surface-muted hover:bg-surface-muted">
          <TableHead className="pl-4">User</TableHead>
          <TableHead className="hidden md:table-cell">Job title</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Last sign-in</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading && !users
          ? Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={5} className="pl-4">
                  <Skeleton className="h-9 w-full" />
                </TableCell>
              </TableRow>
            ))
          : users?.map((user) => (
              <TableRow
                key={user.id}
                data-fit-row
                onClick={() => onSelect(user.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(user.id)
                  }
                }}
                tabIndex={0}
                aria-selected={selectedId === user.id}
                className={cn(
                  'cursor-pointer hover:bg-primary-light/40 focus-visible:bg-primary-light/40 focus-visible:outline-none',
                  selectedId === user.id && 'bg-primary-light/60',
                  !user.is_active && 'text-muted-foreground',
                )}
              >
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary-light text-xs font-semibold text-primary">
                        {initials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p dir="auto" className="truncate font-medium text-navy">
                        {user.full_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span dir="auto">{user.job_title ?? '—'}</span>
                </TableCell>
                <TableCell>{primaryRole(user)?.name ?? '—'}</TableCell>
                <TableCell>
                  <UserStatusBadge user={user} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {user.last_login_at ? formatRelative(user.last_login_at) : 'Never'}
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  )
}
