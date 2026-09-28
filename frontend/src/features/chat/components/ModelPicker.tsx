import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'

import type { ChatModels } from '../model/types'

const DEFAULT = '__default__'

interface ModelPickerProps {
  models: ChatModels | undefined
  value: string | null
  onChange: (model: string | null) => void
  disabled?: boolean
}

/** The admin's allow-list (plan §20). "Default" follows whatever the admin sets as default. */
export function ModelPicker({ models, value, onChange, disabled }: ModelPickerProps) {
  if (!models?.configured || models.models.length === 0) return null
  const defaultName =
    models.models.find((m) => m.id === models.default_model)?.name ?? models.default_model
  return (
    <Select
      value={value ?? DEFAULT}
      onValueChange={(v) => onChange(v === DEFAULT ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 w-56 text-xs" aria-label="AI model">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={DEFAULT}>Default ({defaultName})</SelectItem>
        {models.models.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
