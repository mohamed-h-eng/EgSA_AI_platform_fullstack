import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'

import { notify } from '@features/notifications'
import { ApiError } from '@shared/api/http'
import { Button } from '@shared/ui/button'
import { Label } from '@shared/ui/label'

import { AuthLayout } from '../components/AuthLayout'
import { FieldError, FormError } from '../components/FormError'
import { PasswordInput } from '../components/PasswordInput'
import { useAuth } from '../hooks/useAuth'
import {
  type ChangePasswordValues,
  changePasswordSchema,
  PASSWORD_MIN_LENGTH,
} from '../model/schemas'

const FIELDS = [
  { name: 'current_password', label: 'Current password', autoComplete: 'current-password' },
  { name: 'new_password', label: 'New password', autoComplete: 'new-password' },
  { name: 'confirm_password', label: 'Confirm new password', autoComplete: 'new-password' },
] as const

export function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const forced = user?.must_change_password ?? false

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await changePassword(values)
      notify.success('Password changed', 'Other devices have been signed out.')
      navigate('/', { replace: true })
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Could not change the password.')
    }
  })

  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold">{forced ? 'Set your new password' : 'Change password'}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {forced
          ? 'Your account uses a temporary password. Choose a new one to continue.'
          : 'Changing your password signs you out on all other devices.'}
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
        <FormError message={serverError} />

        {FIELDS.map(({ name, label, autoComplete }) => (
          <div key={name} className="flex flex-col gap-2">
            <Label htmlFor={name}>{label}</Label>
            <PasswordInput
              id={name}
              autoComplete={autoComplete}
              aria-invalid={!!errors[name]}
              aria-describedby={errors[name] ? `${name}-error` : undefined}
              {...register(name)}
            />
            <FieldError id={`${name}-error`} message={errors[name]?.message} />
          </div>
        ))}
        <p className="-mt-2 text-xs text-muted-foreground">
          At least {PASSWORD_MIN_LENGTH} characters.
        </p>

        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {forced ? 'Set password and continue' : 'Change password'}
        </Button>
      </form>

      <div className="mt-6 text-sm">
        {forced ? (
          <button
            type="button"
            onClick={() => void logout()}
            className="text-primary hover:underline"
          >
            Sign out
          </button>
        ) : (
          <Link to="/" className="text-primary hover:underline">
            Back to dashboard
          </Link>
        )}
      </div>
    </AuthLayout>
  )
}
