import type { ReactNode } from 'react'

import { FieldError } from '@shared/ui/form-message'
import { Label } from '@shared/ui/label'

interface FormFieldProps {
  id: string
  label: string
  error?: string
  /** Rendered as `${id}-hint`; point the control's aria-describedby at it. */
  hint?: string
  children: ReactNode
}

/** Label + control + hint/error. Errors render as `${id}-error` for aria-describedby. */
export function FormField({ id, label, error, hint, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}
