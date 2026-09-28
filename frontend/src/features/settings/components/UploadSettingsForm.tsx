import { RotateCcw } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { notify } from '@features/notifications'
import { formatDateTime } from '@shared/lib/format'
import { Button } from '@shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card'
import { FormField } from '@shared/ui/form-field'
import { FieldError } from '@shared/ui/form-message'
import { Input } from '@shared/ui/input'

import { useUpdateUploadSettings } from '../api/settings.queries'
import {
  MAX_UPLOAD_MB_LIMIT,
  UPLOAD_FILE_TYPES,
  type UploadFileType,
  type UploadSettings,
} from '../model/types'

const TYPE_LABELS: Record<UploadFileType, string> = {
  pdf: 'PDF',
  docx: 'Word (DOCX)',
  txt: 'Plain text (TXT)',
}

/** Admin override of the upload limits; the backend enforces them on every upload. */
export function UploadSettingsForm({ settings }: { settings: UploadSettings }) {
  const [maxMb, setMaxMb] = useState(String(settings.max_upload_mb))
  const [types, setTypes] = useState<UploadFileType[]>(settings.allowed_file_types)
  const [errors, setErrors] = useState<{ maxMb?: string; types?: string }>({})
  const update = useUpdateUploadSettings()

  const toggle = (type: UploadFileType, on: boolean) =>
    setTypes((current) => UPLOAD_FILE_TYPES.filter((t) => (t === type ? on : current.includes(t))))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const mb = Number(maxMb)
    const next: typeof errors = {}
    if (!Number.isInteger(mb) || mb < 1 || mb > MAX_UPLOAD_MB_LIMIT) {
      next.maxMb = `Enter a whole number from 1 to ${MAX_UPLOAD_MB_LIMIT}.`
    }
    if (types.length === 0) next.types = 'Allow at least one file type.'
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      await update.mutateAsync({ max_upload_mb: mb, allowed_file_types: types })
      notify.success('Upload settings saved')
    } catch (error) {
      notify.apiError(error)
    }
  }

  const reset = async () => {
    try {
      const saved = await update.mutateAsync({
        max_upload_mb: settings.env_max_upload_mb,
        allowed_file_types: settings.env_allowed_file_types,
        reset: true,
      })
      setMaxMb(String(saved.max_upload_mb))
      setTypes(saved.allowed_file_types)
      setErrors({})
      notify.success('Upload settings reset to defaults')
    } catch (error) {
      notify.apiError(error)
    }
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Document uploads</CardTitle>
        <CardDescription>
          Limits applied to every upload. Defaults come from the server configuration (
          {settings.env_max_upload_mb} MB;{' '}
          {settings.env_allowed_file_types.map((t) => t.toUpperCase()).join(', ')}).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void save(e)} className="flex max-w-lg flex-col gap-5" noValidate>
          <FormField
            id="max-upload-mb"
            label="Maximum file size (MB)"
            error={errors.maxMb}
            hint={`Between 1 and ${MAX_UPLOAD_MB_LIMIT} MB.`}
          >
            <Input
              id="max-upload-mb"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_UPLOAD_MB_LIMIT}
              value={maxMb}
              onChange={(e) => setMaxMb(e.target.value)}
              aria-invalid={!!errors.maxMb}
              aria-describedby={errors.maxMb ? 'max-upload-mb-error' : 'max-upload-mb-hint'}
              className="w-40"
            />
          </FormField>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Allowed file types</legend>
            {UPLOAD_FILE_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={types.includes(type)}
                  onChange={(e) => toggle(type, e.target.checked)}
                />
                {TYPE_LABELS[type]}
              </label>
            ))}
            <FieldError id="allowed-types-error" message={errors.types} />
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={update.isPending}>
              Save upload settings
            </Button>
            {settings.overridden && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void reset()}
                disabled={update.isPending}
              >
                <RotateCcw aria-hidden />
                Reset to defaults
              </Button>
            )}
          </div>
          {settings.overridden && settings.updated_at && (
            <p className="text-xs text-muted-foreground">
              Last changed {formatDateTime(settings.updated_at)}
              {settings.updated_by && ` by ${settings.updated_by.full_name}`}.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
