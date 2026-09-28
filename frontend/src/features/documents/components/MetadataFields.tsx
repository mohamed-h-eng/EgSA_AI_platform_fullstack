import {
  type Control,
  Controller,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from 'react-hook-form'

import { FormField } from '@shared/ui/form-field'
import { Input } from '@shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { Textarea } from '@shared/ui/textarea'

import { useCategories } from '../api/documents.queries'
import type { EditDocumentValues } from '../model/schemas'
import { DOCUMENT_STATUSES, STATUS_META } from '../model/types'

const NO_CATEGORY = '__none__'

// Upload and edit forms share these fields; both value types include EditDocumentValues.
interface MetadataFieldsProps<T extends FieldValues & EditDocumentValues> {
  idPrefix: string
  register: UseFormRegister<T>
  control: Control<T>
  errors: FieldErrors<T>
}

/** Code, title, category, revision, status and description: shared by upload and edit. */
export function MetadataFields<T extends FieldValues & EditDocumentValues>({
  idPrefix,
  register: registerField,
  control,
  errors: formErrors,
}: MetadataFieldsProps<T>) {
  const { data: categories = [] } = useCategories()
  const errors = formErrors as FieldErrors<EditDocumentValues>
  const register = (name: keyof EditDocumentValues) => registerField(name as Path<T>)
  const fieldName = (name: keyof EditDocumentValues) => name as Path<T>
  const id = (name: string) => `${idPrefix}-${name}`
  const describedBy = (name: keyof EditDocumentValues) =>
    errors[name] ? `${id(name)}-error` : undefined

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <FormField id={id('code')} label="Document code" error={errors.code?.message}>
          <Input
            id={id('code')}
            placeholder="EPS-SRS-001"
            className="font-mono uppercase"
            aria-invalid={!!errors.code}
            aria-describedby={describedBy('code')}
            {...register('code')}
          />
        </FormField>
        <FormField id={id('title')} label="Title" error={errors.title?.message}>
          <Input
            id={id('title')}
            dir="auto"
            aria-invalid={!!errors.title}
            aria-describedby={describedBy('title')}
            {...register('title')}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id={id('category')} label="Category">
          <Controller
            control={control}
            name={fieldName('category')}
            render={({ field }) => (
              <Select
                value={field.value || NO_CATEGORY}
                onValueChange={(v) => field.onChange(v === NO_CATEGORY ? '' : v)}
              >
                <SelectTrigger id={id('category')} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField id={id('revision')} label="Revision" error={errors.revision?.message}>
          <Input id={id('revision')} placeholder="A" {...register('revision')} />
        </FormField>
        <FormField id={id('status')} label="Status">
          <Controller
            control={control}
            name={fieldName('status')}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={id('status')} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>

      <FormField
        id={id('description')}
        label="Description (optional)"
        error={errors.description?.message}
      >
        <Textarea id={id('description')} dir="auto" rows={3} {...register('description')} />
      </FormField>
    </>
  )
}
