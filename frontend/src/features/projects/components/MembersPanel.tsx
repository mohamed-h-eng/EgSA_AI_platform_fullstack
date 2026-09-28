import { UserPlus, X } from 'lucide-react'
import { useState } from 'react'

import { notify } from '@features/notifications'
import { formatDateTime } from '@shared/lib/format'
import { initials } from '@shared/lib/initials'
import { Avatar, AvatarFallback } from '@shared/ui/avatar'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/confirm-dialog'
import { FormError } from '@shared/ui/form-message'
import { Skeleton } from '@shared/ui/skeleton'
import { StatusBadge } from '@shared/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table'

import { useMembers, useRemoveMember, useUpdateMember } from '../api/projects.queries'
import { type Member, type ProjectDetail, ROLE_META } from '../model/types'
import { AddMemberDialog } from './AddMemberDialog'
import { ProjectRoleSelect } from './ProjectRoleSelect'

export function MembersPanel({ project }: { project: ProjectDetail }) {
  const canManage = project.abilities.can_manage_members
  const { data: members, isPending, isError, error } = useMembers(project.id)
  const updateMember = useUpdateMember(project.id)
  const removeMember = useRemoveMember(project.id)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Member | null>(null)

  const changeRole = async (member: Member, role: Member['project_role']) => {
    try {
      await updateMember.mutateAsync({ userId: member.user.id, role })
      notify.success('Role updated', `${member.user.full_name} is now ${ROLE_META[role].label}.`)
    } catch (err) {
      notify.apiError(err)
    }
  }

  const confirmRemove = async () => {
    if (!removing) return
    try {
      await removeMember.mutateAsync(removing.user.id)
      notify.success('Member removed', removing.user.full_name)
      setRemoving(null)
    } catch (err) {
      setRemoving(null)
      notify.apiError(err)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Members can see this project and its documents. Leads manage the project.
        </p>
        {canManage && (
          <Button onClick={() => setAdding(true)}>
            <UserPlus aria-hidden />
            Add member
          </Button>
        )}
      </div>

      {isError ? (
        <FormError message={error.message} />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-muted hover:bg-surface-muted">
                <TableHead className="pl-4">Member</TableHead>
                <TableHead>Project role</TableHead>
                <TableHead className="hidden md:table-cell">Added</TableHead>
                {canManage && (
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending
                ? Array.from({ length: 3 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4} className="pl-4">
                        <Skeleton className="h-9 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : members.map((member) => (
                    <TableRow key={member.user.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-primary-light text-xs font-semibold text-primary">
                              {initials(member.user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p dir="auto" className="truncate font-medium text-navy">
                              {member.user.full_name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {member.user.email}
                            </p>
                          </div>
                          {!member.user_is_active && (
                            <StatusBadge tone="danger">Disabled</StatusBadge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {canManage ? (
                          <ProjectRoleSelect
                            value={member.project_role}
                            onChange={(role) => void changeRole(member, role)}
                            disabled={updateMember.isPending}
                            aria-label={`Project role for ${member.user.full_name}`}
                          />
                        ) : (
                          ROLE_META[member.project_role].label
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {formatDateTime(member.added_at)}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setRemoving(member)}
                            aria-label={`Remove ${member.user.full_name}`}
                          >
                            <X aria-hidden />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}

      {canManage && (
        <AddMemberDialog
          projectId={project.id}
          projectCode={project.code}
          existingMemberIds={members?.map((m) => m.user.id) ?? []}
          open={adding}
          onOpenChange={setAdding}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove member?"
        description={
          <>
            <span dir="auto">{removing?.user.full_name}</span> will lose access to {project.code}{' '}
            and its documents.
          </>
        }
        confirmLabel="Remove"
        destructive
        pending={removeMember.isPending}
        onConfirm={() => void confirmRemove()}
      />
    </div>
  )
}
