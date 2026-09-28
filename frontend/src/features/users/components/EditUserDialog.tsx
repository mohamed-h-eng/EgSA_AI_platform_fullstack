import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

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

import { useUpdateUser } from '../api/users.queries'
import { type EditUserValues, editUserSchema } from '../model/schemas'
import type { ManagedUser } from '../model/types'

interface EditUserDialogProps {
  user: ManagedUser
  open: boolean
  onOpenChange: (open: boolean) => void
}

const toValues = (user: ManagedUser): EditUserValues => ({
  full_name: user.full_name,
  email: user.email,
  job_title: user.job_title ?? '',
})

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted only while open, so every open starts from the user's current values. */}
        <EditUserForm user={user} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function EditUserForm({ user, onDone }: { user: ManagedUser; onDone: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const update = useUpdateUser(user.id)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: toValues(user),
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await update.mutateAsync(values)
      notify.success('User updated')
      onDone()
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_EXISTS') {
        setError('email', { message: error.message })
      } else {
        setServerError(error instanceof ApiError ? error.message : 'Could not save the changes.')
      }
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Edit user</DialogTitle>
        <DialogDescription>Update the profile details for this account.</DialogDescription>
      </DialogHeader>

      <FormError message={serverError} />

      <FormField id="edit-full_name" label="Full name" error={errors.full_name?.message}>
        <Input
          id="edit-full_name"
          dir="auto"
          aria-invalid={!!errors.full_name}
          aria-describedby={errors.full_name ? 'edit-full_name-error' : undefined}
          {...register('full_name')}
        />
      </FormField>
      <FormField id="edit-email" label="Email" error={errors.email?.message}>
        <Input
          id="edit-email"
          type="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'edit-email-error' : undefined}
          {...register('email')}
        />
      </FormField>
      <FormField id="edit-job_title" label="Job title" error={errors.job_title?.message}>
        <Input id="edit-job_title" dir="auto" {...register('job_title')} />
      </FormField>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Save changes
        </Button>
      </DialogFooter>
    </form>
  )
}
