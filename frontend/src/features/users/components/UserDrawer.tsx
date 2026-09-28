import { KeyRound, Pencil, Power, ShieldCheck } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { Can, useAuth } from '@features/auth'
import { notify } from '@features/notifications'
import { UserProjectsSection } from '@features/projects'
import { formatDateTime } from '@shared/lib/format'
import { initials } from '@shared/lib/initials'
import { Avatar, AvatarFallback } from '@shared/ui/avatar'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog'
import { Separator } from '@shared/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@shared/ui/sheet'
import { Skeleton } from '@shared/ui/skeleton'

import { useResetPassword, useSetUserActive, useUser } from '../api/users.queries'
import { type ManagedUser, primaryRole } from '../model/types'
import { ChangeRoleDialog } from './ChangeRoleDialog'
import { EditUserDialog } from './EditUserDialog'
import { TempPasswordReveal } from './TempPasswordReveal'
import { UserStatusBadge } from './UserStatusBadge'

interface UserDrawerProps {
  userId: string | null
  onClose: () => void
}

export function UserDrawer({ userId, onClose }: UserDrawerProps) {
  const { data: user, isPending, isError } = useUser(userId)

  return (
    <Sheet open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {user ? (
          <UserDetails user={user} />
        ) : (
          <SheetHeader>
            <SheetTitle>{isError ? 'User not found' : 'Loading user…'}</SheetTitle>
            <SheetDescription className="sr-only">User details</SheetDescription>
            {isPending && <Skeleton className="mt-4 h-40 w-full" />}
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  )
}

type OpenDialog = 'edit' | 'role' | 'reset' | 'toggle' | null

function UserDetails({ user }: { user: ManagedUser }) {
  const { user: me } = useAuth()
  const isSelf = me?.id === user.id
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const setActive = useSetUserActive(user.id)
  const reset = useResetPassword(user.id)

  const toggleActive = async () => {
    try {
      await setActive.mutateAsync(!user.is_active)
      notify.success(user.is_active ? 'User disabled' : 'User enabled', user.full_name)
      setDialog(null)
    } catch (error) {
      notify.apiError(error)
    }
  }

  const resetPassword = async () => {
    try {
      const res = await reset.mutateAsync()
      setDialog(null)
      setTempPassword(res.temporary_password)
    } catch (error) {
      notify.apiError(error)
    }
  }

  return (
    <>
      <SheetHeader className="border-b pb-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-primary-light text-lg font-semibold text-primary">
              {initials(user.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <SheetTitle dir="auto" className="truncate text-lg">
              {user.full_name}
            </SheetTitle>
            <SheetDescription className="truncate">{user.email}</SheetDescription>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <UserStatusBadge user={user} />
          {isSelf && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              Your account
            </span>
          )}
        </div>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 text-sm">
          <Detail label="Role">{primaryRole(user)?.name ?? '—'}</Detail>
          <Detail label="Job title">
            <span dir="auto">{user.job_title ?? '—'}</span>
          </Detail>
          <Detail label="Last sign-in">{formatDateTime(user.last_login_at)}</Detail>
          <Detail label="Created">{formatDateTime(user.created_at)}</Detail>
        </dl>

        <Separator />

        <UserProjectsSection
          userId={user.id}
          userName={user.full_name}
          userIsActive={user.is_active}
        />

        <Separator />

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Actions</h3>
          <Can permission="users:update">
            <ActionButton icon={<Pencil />} onClick={() => setDialog('edit')}>
              Edit details
            </ActionButton>
          </Can>
          {!isSelf && (
            <>
              <Can permission="roles:assign">
                <ActionButton icon={<ShieldCheck />} onClick={() => setDialog('role')}>
                  Change role
                </ActionButton>
              </Can>
              <Can permission="users:update">
                <ActionButton icon={<KeyRound />} onClick={() => setDialog('reset')}>
                  Reset password
                </ActionButton>
              </Can>
              <Can permission="users:disable">
                <ActionButton
                  icon={<Power />}
                  onClick={() => setDialog('toggle')}
                  destructive={user.is_active}
                >
                  {user.is_active ? 'Disable account' : 'Enable account'}
                </ActionButton>
              </Can>
            </>
          )}
        </div>
      </div>

      <EditUserDialog
        user={user}
        open={dialog === 'edit'}
        onOpenChange={(o) => setDialog(o ? 'edit' : null)}
      />
      <ChangeRoleDialog
        user={user}
        open={dialog === 'role'}
        onOpenChange={(o) => setDialog(o ? 'role' : null)}
      />

      <ConfirmDialog
        open={dialog === 'reset'}
        onOpenChange={(o) => setDialog(o ? 'reset' : null)}
        title="Reset password?"
        description={
          <>
            A new temporary password will be generated and <span dir="auto">{user.full_name}</span>{' '}
            will be signed out everywhere. They must set a new password at their next sign-in.
          </>
        }
        confirmLabel="Reset password"
        pending={reset.isPending}
        onConfirm={() => void resetPassword()}
      />

      <ConfirmDialog
        open={dialog === 'toggle'}
        onOpenChange={(o) => setDialog(o ? 'toggle' : null)}
        title={user.is_active ? 'Disable this account?' : 'Enable this account?'}
        description={
          user.is_active ? (
            <>
              <span dir="auto">{user.full_name}</span> will be signed out immediately and won't be
              able to sign in until the account is enabled again.
            </>
          ) : (
            <>
              <span dir="auto">{user.full_name}</span> will be able to sign in again.
            </>
          )
        }
        confirmLabel={user.is_active ? 'Disable account' : 'Enable account'}
        destructive={user.is_active}
        pending={setActive.isPending}
        onConfirm={() => void toggleActive()}
      />

      <Dialog open={!!tempPassword} onOpenChange={(o) => !o && setTempPassword(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Password reset</DialogTitle>
            <DialogDescription>New temporary password for this account.</DialogDescription>
          </DialogHeader>
          {tempPassword && <TempPasswordReveal password={tempPassword} userName={user.full_name} />}
          <DialogFooter>
            <Button onClick={() => setTempPassword(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-navy">{children}</dd>
    </>
  )
}

function ActionButton({
  icon,
  children,
  onClick,
  destructive = false,
}: {
  icon: ReactNode
  children: ReactNode
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={destructive ? 'justify-start text-danger hover:text-danger' : 'justify-start'}
    >
      <span aria-hidden className="[&>svg]:size-4">
        {icon}
      </span>
      {children}
    </Button>
  )
}
