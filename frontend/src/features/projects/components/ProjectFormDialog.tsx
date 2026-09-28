import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { notify } from '@features/notifications'
import { ApiError } from '@shared/api/http'
import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog'
import { FormField } from '@shared/ui/form-field'
import { FormError } from '@shared/ui/form-message'
import { Input } from '@shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { Textarea } from '@shared/ui/textarea'

import { useCreateProject, useUpdateProject } from '../api/projects.queries'
import { type ProjectValues, projectSchema } from '../model/schemas'
import { PROJECT_STATUSES, type ProjectDetail, STATUS_META } from '../model/types'

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Omit to create a new project. */
  project?: ProjectDetail
}

export function ProjectFormDialog({ open, onOpenChange, project }: ProjectFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted only while open, so each open starts from fresh values. */}
        {project ? (
          <EditForm project={project} onDone={() => onOpenChange(false)} />
        ) : (
          <CreateForm onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const create = useCreateProject()
  const navigate = useNavigate()
  return (
    <ProjectForm
      title="New project"
      description="You'll be the project lead and can add members next."
      submitLabel="Create project"
      pending={create.isPending}
      defaultValues={{ code: '', name: '', subsystem: '', description: '', status: 'planning' }}
      onSubmit={async (values) => {
        const project = await create.mutateAsync(values)
        notify.success('Project created', project.code)
        onDone()
        navigate(`/projects/${project.id}`)
      }}
      onCancel={onDone}
    />
  )
}

function EditForm({ project, onDone }: { project: ProjectDetail; onDone: () => void }) {
  const update = useUpdateProject(project.id)
  return (
    <ProjectForm
      title="Edit project"
      description={`Update the details of ${project.code}.`}
      submitLabel="Save changes"
      codeLocked
      pending={update.isPending}
      defaultValues={{
        code: project.code,
        name: project.name,
        subsystem: project.subsystem ?? '',
        description: project.description ?? '',
        status: project.status,
      }}
      onSubmit={async (values) => {
        await update.mutateAsync(values)
        notify.success('Project updated')
        onDone()
      }}
      onCancel={onDone}
    />
  )
}

interface ProjectFormProps {
  title: string
  description: string
  submitLabel: string
  defaultValues: ProjectValues
  pending: boolean
  codeLocked?: boolean
  onSubmit: (values: ProjectValues) => Promise<void>
  onCancel: () => void
}

function ProjectForm({
  title,
  description,
  submitLabel,
  defaultValues,
  pending,
  codeLocked = false,
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProjectValues>({ resolver: zodResolver(projectSchema), defaultValues })

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await onSubmit(values)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PROJECT_CODE_EXISTS') {
        setError('code', { message: error.message })
      } else {
        setServerError(error instanceof ApiError ? error.message : 'Could not save the project.')
      }
    }
  })

  const describedBy = (name: keyof ProjectValues) =>
    errors[name] ? `project-${name}-error` : undefined

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <FormError message={serverError} />

      <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
        <FormField
          id="project-code"
          label="Code"
          error={errors.code?.message}
          hint={codeLocked ? 'The code cannot be changed.' : undefined}
        >
          <Input
            id="project-code"
            placeholder="NEXSAT-1"
            className="font-mono uppercase"
            readOnly={codeLocked}
            aria-invalid={!!errors.code}
            aria-describedby={describedBy('code') ?? (codeLocked ? 'project-code-hint' : undefined)}
            autoFocus={!codeLocked}
            {...register('code')}
          />
        </FormField>
        <FormField id="project-name" label="Name" error={errors.name?.message}>
          <Input
            id="project-name"
            dir="auto"
            aria-invalid={!!errors.name}
            aria-describedby={describedBy('name')}
            autoFocus={codeLocked}
            {...register('name')}
          />
        </FormField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="project-subsystem"
          label="Subsystem (optional)"
          error={errors.subsystem?.message}
        >
          <Input id="project-subsystem" dir="auto" placeholder="EPS" {...register('subsystem')} />
        </FormField>
        <FormField id="project-status" label="Status">
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="project-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
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
        id="project-description"
        label="Description (optional)"
        error={errors.description?.message}
      >
        <Textarea id="project-description" dir="auto" rows={4} {...register('description')} />
      </FormField>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
