import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'

import { useVisibleProjects } from '../api/projects.queries'
import type { Project } from '../model/types'

const NONE = '__none__'

interface ProjectSelectProps {
  value: string | null
  onChange: (projectId: string | null) => void
  id?: string
  /** Label for the "no project" option; omit to require a project. */
  noneLabel?: string
  placeholder?: string
  className?: string
  'aria-label'?: string
  /** Limit the choices, e.g. to projects the user can upload to. */
  filter?: (project: Project) => boolean
  disabled?: boolean
}

/**
 * Picker over the projects the current user can see. Public: reused by documents (phase 05)
 * and chat (phase 06) to associate items with a project.
 */
export function ProjectSelect({
  value,
  onChange,
  id,
  noneLabel,
  placeholder = 'Choose a project',
  className = 'w-full',
  'aria-label': ariaLabel,
  filter,
  disabled = false,
}: ProjectSelectProps) {
  const { data = [], isPending } = useVisibleProjects()
  const projects = filter ? data.filter(filter) : data
  return (
    <Select
      value={value ?? (noneLabel ? NONE : '')}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={isPending || disabled}
    >
      <SelectTrigger id={id} className={className} aria-label={ariaLabel}>
        <SelectValue placeholder={isPending ? 'Loading projects…' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <span className="font-mono">{p.code}</span>
            <span dir="auto" className="text-muted-foreground">
              {p.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
