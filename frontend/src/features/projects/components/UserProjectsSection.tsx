import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { Can } from '@features/auth'
import { notify } from '@features/notifications'
import { Button } from '@shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { Skeleton } from '@shared/ui/skeleton'

import * as api from '../api/projects.api'
import { projectsKeys, useUserMemberships, useVisibleProjects } from '../api/projects.queries'
import { type ProjectRole, ROLE_META, type UserMembership } from '../model/types'
import { ProjectRoleSelect } from './ProjectRoleSelect'

interface UserProjectsSectionProps {
  userId: string
  userName: string
  userIsActive: boolean
}

/** "Projects" section of the admin user drawer (plan §9: assign projects). */
export function UserProjectsSection({ userId, userName, userIsActive }: UserProjectsSectionProps) {
  const { data: memberships, isError } = useUserMemberships(userId)
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)

  // Membership mutations here target many projects, so call the API directly and refresh caches.
  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key)
    try {
      await action()
      notify.success(success, userName)
      await queryClient.invalidateQueries({ queryKey: projectsKeys.all })
    } catch (error) {
      notify.apiError(error)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Projects</h3>
      {isError ? (
        <p className="text-sm text-danger">Could not load project memberships.</p>
      ) : !memberships ? (
        <Skeleton className="h-16 w-full" />
      ) : memberships.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not a member of any project.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {memberships.map((m) => (
            <MembershipRow
              key={m.project_id}
              membership={m}
              busy={busy === m.project_id}
              onRemove={() =>
                void run(
                  m.project_id,
                  () => api.removeMember(m.project_id, userId),
                  `Removed from ${m.code}`,
                )
              }
            />
          ))}
        </ul>
      )}
      {userIsActive && (
        <Can permission="projects:manage_members">
          <AssignProject
            exclude={memberships?.map((m) => m.project_id) ?? []}
            busy={busy === 'assign'}
            onAssign={(projectId, code, role) =>
              void run('assign', () => api.addMember(projectId, userId, role), `Added to ${code}`)
            }
          />
        </Can>
      )}
    </section>
  )
}

function MembershipRow({
  membership,
  busy,
  onRemove,
}: {
  membership: UserMembership
  busy: boolean
  onRemove: () => void
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <Link to={`/projects/${membership.project_id}`} className="min-w-0 flex-1 hover:underline">
        <span className="font-mono font-medium text-navy">{membership.code}</span>
        <span dir="auto" className="block truncate text-xs text-muted-foreground">
          {membership.name}
        </span>
      </Link>
      <span className="text-xs text-muted-foreground">
        {ROLE_META[membership.project_role].label}
      </span>
      <Can permission="projects:manage_members">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={busy}
          onClick={onRemove}
          aria-label={`Remove from ${membership.code}`}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
        </Button>
      </Can>
    </li>
  )
}

function AssignProject({
  exclude,
  busy,
  onAssign,
}: {
  exclude: string[]
  busy: boolean
  onAssign: (projectId: string, code: string, role: ProjectRole) => void
}) {
  const { data: projects = [] } = useVisibleProjects()
  const [projectId, setProjectId] = useState('')
  const [role, setRole] = useState<ProjectRole>('engineer')
  const options = projects.filter((p) => !exclude.includes(p.id))
  if (options.length === 0) return null

  const project = options.find((p) => p.id === projectId)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={projectId} onValueChange={setProjectId}>
        <SelectTrigger className="min-w-40 flex-1" aria-label="Project to add">
          <SelectValue placeholder="Add to project…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <span className="font-mono">{p.code}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ProjectRoleSelect
        value={role}
        onChange={setRole}
        className="w-32"
        aria-label="Project role"
      />
      <Button
        variant="outline"
        size="icon"
        disabled={!project || busy}
        onClick={() => {
          if (!project) return
          onAssign(project.id, project.code, role)
          setProjectId('')
        }}
        aria-label="Add to project"
      >
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
      </Button>
    </div>
  )
}
