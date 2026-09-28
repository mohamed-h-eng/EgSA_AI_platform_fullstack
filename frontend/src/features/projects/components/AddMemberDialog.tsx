import { Check, Loader2, Search } from 'lucide-react'
import { useState } from 'react'

import { notify } from '@features/notifications'
import { useDebounce } from '@shared/hooks/useDebounce'
import { initials } from '@shared/lib/initials'
import { cn } from '@shared/lib/utils'
import { Avatar, AvatarFallback } from '@shared/ui/avatar'
import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog'
import { FormField } from '@shared/ui/form-field'
import { FormError } from '@shared/ui/form-message'
import { Input } from '@shared/ui/input'

import { useAddMember, useUserSearch } from '../api/projects.queries'
import type { ProjectRole, UserSummary } from '../model/types'
import { ProjectRoleSelect } from './ProjectRoleSelect'

interface AddMemberDialogProps {
  projectId: string
  projectCode: string
  existingMemberIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddMemberDialog(props: AddMemberDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <AddMemberForm {...props} onDone={() => props.onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function AddMemberForm({
  projectId,
  projectCode,
  existingMemberIds,
  onDone,
}: AddMemberDialogProps & { onDone: () => void }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<UserSummary | null>(null)
  const [role, setRole] = useState<ProjectRole>('engineer')
  const [error, setError] = useState<string | null>(null)
  const q = useDebounce(search.trim())
  const { data: candidates = [], isFetching } = useUserSearch(q, q.length >= 1)
  const add = useAddMember(projectId)

  const available = candidates.filter((u) => !existingMemberIds.includes(u.id))

  const submit = async () => {
    if (!selected) return
    setError(null)
    try {
      await add.mutateAsync({ userId: selected.id, role })
      notify.success('Project access granted', `${selected.full_name} → ${projectCode}`)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the member.')
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add member</DialogTitle>
        <DialogDescription>Give a user access to {projectCode}.</DialogDescription>
      </DialogHeader>

      <FormError message={error} />

      <FormField id="member-search" label="User">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="member-search"
            type="search"
            dir="auto"
            autoFocus
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelected(null)
            }}
            className="pl-9"
          />
        </div>
      </FormField>

      <div
        role="listbox"
        aria-label="Matching users"
        className="-mt-2 max-h-56 overflow-y-auto rounded-md border"
      >
        {!q ? (
          <p className="p-3 text-sm text-muted-foreground">Start typing to find a user.</p>
        ) : isFetching && available.length === 0 ? (
          <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Searching…
          </p>
        ) : available.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            No active users found who aren't already members.
          </p>
        ) : (
          available.map((user) => (
            <button
              key={user.id}
              type="button"
              role="option"
              aria-selected={selected?.id === user.id}
              onClick={() => setSelected(user)}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-primary-light/50 focus-visible:bg-primary-light/50 focus-visible:outline-none',
                selected?.id === user.id && 'bg-primary-light',
              )}
            >
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary-light text-xs text-primary">
                  {initials(user.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span dir="auto" className="block truncate text-sm font-medium text-navy">
                  {user.full_name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
              {selected?.id === user.id && <Check className="size-4 text-primary" aria-hidden />}
            </button>
          ))
        )}
      </div>

      <FormField id="member-role" label="Project role">
        <ProjectRoleSelect id="member-role" value={role} onChange={setRole} className="w-full" />
      </FormField>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={() => void submit()} disabled={!selected || add.isPending}>
          {add.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Add member
        </Button>
      </DialogFooter>
    </>
  )
}
