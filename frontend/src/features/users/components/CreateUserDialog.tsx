import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

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

import { useCreateUser } from '../api/users.queries'
import { type CreateUserValues, createUserSchema, TEMP_PASSWORD_MIN } from '../model/schemas'
import type { CreatedUser } from '../model/types'
import { RoleSelect } from './RoleSelect'
import { TempPasswordReveal } from './TempPasswordReveal'

const EMPTY: CreateUserValues = {
  full_name: '',
  email: '',
  job_title: '',
  role: '',
  temporary_password: '',
}

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted only while open: closing discards the form and the revealed password. */}
        <CreateUserFlow onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CreateUserFlow({ onDone }: { onDone: () => void }) {
  const [created, setCreated] = useState<CreatedUser | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const createUser = useCreateUser()

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateUserValues>({ resolver: zodResolver(createUserSchema), defaultValues: EMPTY })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const result = await createUser.mutateAsync(values)
      setCreated(result)
      notify.success('User added', result.user.full_name)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_EXISTS') {
        setError('email', { message: error.message })
      } else {
        setServerError(error instanceof ApiError ? error.message : 'Could not create the user.')
      }
    }
  })

  return created ? (
    <>
      <DialogHeader>
        <DialogTitle>User created</DialogTitle>
        <DialogDescription>
          <span dir="auto">{created.user.full_name}</span> can now sign in with this temporary
          password.
        </DialogDescription>
      </DialogHeader>
      <TempPasswordReveal password={created.temporary_password} userName={created.user.full_name} />
      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </>
  ) : (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Add user</DialogTitle>
        <DialogDescription>
          The user signs in with a temporary password and must change it right away.
        </DialogDescription>
      </DialogHeader>

      <FormError message={serverError} />

      <FormField id="full_name" label="Full name" error={errors.full_name?.message}>
        <Input
          id="full_name"
          dir="auto"
          autoFocus
          aria-invalid={!!errors.full_name}
          aria-describedby={errors.full_name ? 'full_name-error' : undefined}
          {...register('full_name')}
        />
      </FormField>

      <FormField id="email" label="Email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="off"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="job_title" label="Job title (optional)" error={errors.job_title?.message}>
          <Input id="job_title" dir="auto" {...register('job_title')} />
        </FormField>
        <FormField id="role" label="Role" error={errors.role?.message}>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <RoleSelect
                id="role"
                value={field.value}
                onChange={field.onChange}
                invalid={!!errors.role}
                describedBy={errors.role ? 'role-error' : undefined}
              />
            )}
          />
        </FormField>
      </div>

      <FormField
        id="temporary_password"
        label="Temporary password (optional)"
        error={errors.temporary_password?.message}
        hint={`Leave empty to generate a strong one. Minimum ${TEMP_PASSWORD_MIN} characters.`}
      >
        <Input
          id="temporary_password"
          autoComplete="new-password"
          aria-invalid={!!errors.temporary_password}
          aria-describedby={
            errors.temporary_password ? 'temporary_password-error' : 'temporary_password-hint'
          }
          {...register('temporary_password')}
        />
      </FormField>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={createUser.isPending}>
          {createUser.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Add user
        </Button>
      </DialogFooter>
    </form>
  )
}
