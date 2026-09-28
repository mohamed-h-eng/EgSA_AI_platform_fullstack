import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'

import { PROJECT_ROLES, type ProjectRole, ROLE_META } from '../model/types'

interface ProjectRoleSelectProps {
  value: ProjectRole
  onChange: (role: ProjectRole) => void
  id?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function ProjectRoleSelect({
  value,
  onChange,
  id,
  disabled,
  className = 'w-36',
  'aria-label': ariaLabel,
}: ProjectRoleSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ProjectRole)} disabled={disabled}>
      <SelectTrigger id={id} className={className} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROJECT_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            <span className="flex flex-col items-start">
              <span>{ROLE_META[role].label}</span>
              <span className="text-xs text-muted-foreground">{ROLE_META[role].hint}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
