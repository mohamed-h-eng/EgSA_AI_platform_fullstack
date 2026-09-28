import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { notify } from '@features/notifications'
import { ApiError } from '@shared/api/http'
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

import { useAssignRole } from '../api/users.queries'
import { type ManagedUser, primaryRole } from '../model/types'
import { RoleSelect } from './RoleSelect'

interface ChangeRoleDialogProps {
  user: ManagedUser
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangeRoleDialog({ user, open, onOpenChange }: ChangeRoleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so the selection always starts at the current role. */}
        <ChangeRoleForm user={user} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ChangeRoleForm({ user, onDone }: { user: ManagedUser; onDone: () => void }) {
  const current = primaryRole(user)?.code ?? ''
  const [role, setRole] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const assign = useAssignRole(user.id)

  const save = async () => {
    setError(null)
    try {
      const updated = await assign.mutateAsync(role)
      notify.success('Role changed', `${updated.full_name} is now ${primaryRole(updated)?.name}.`)
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the role.')
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Change role</DialogTitle>
        <DialogDescription>
          The new permissions apply to <span dir="auto">{user.full_name}</span> immediately.
        </DialogDescription>
      </DialogHeader>
      <FormError message={error} />
      <FormField id="change-role" label="Role">
        <RoleSelect id="change-role" value={role} onChange={setRole} />
      </FormField>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={assign.isPending || role === current}>
          {assign.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Save role
        </Button>
      </DialogFooter>
    </>
  )
}
