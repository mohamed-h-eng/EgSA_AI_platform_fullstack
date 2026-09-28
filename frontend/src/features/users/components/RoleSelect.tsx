import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'

import { useRoles } from '../api/users.queries'

interface RoleSelectProps {
  id?: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  describedBy?: string
}

export function RoleSelect({ id, value, onChange, invalid, describedBy }: RoleSelectProps) {
  const { data: roles = [], isPending } = useRoles()
  return (
    <Select value={value} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger
        id={id}
        className="w-full"
        aria-invalid={invalid}
        aria-describedby={describedBy}
      >
        <SelectValue placeholder={isPending ? 'Loading roles…' : 'Choose a role'} />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role.code} value={role.code}>
            <span className="flex flex-col items-start">
              <span>{role.name}</span>
              {role.description && (
                <span className="text-xs text-muted-foreground">{role.description}</span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
