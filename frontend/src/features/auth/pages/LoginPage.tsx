import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { ApiError } from '@shared/api/http'
import { Button } from '@shared/ui/button'
import { FieldError, FormError } from '@shared/ui/form-message'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'

import { AuthLayout } from '../components/AuthLayout'
import { PasswordInput } from '../components/PasswordInput'
import { useAuth } from '../hooks/useAuth'
import { type LoginValues, loginSchema } from '../model/schemas'

interface LocationState {
  from?: string
}

export function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LocationState | null)?.from ?? '/'
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  if (status === 'authenticated') return <Navigate to={from} replace />

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await login(values)
      navigate(from, { replace: true })
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'Sign-in failed. Please try again.',
      )
    }
  })

  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold">Sign in</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Use your EgSA AI Engineering Platform account.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
        <FormError message={serverError} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            autoFocus
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
          <FieldError id="email-error" message={errors.email?.message} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
          />
          <FieldError id="password-error" message={errors.password?.message} />
        </div>

        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2">
          {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Sign in
        </Button>
      </form>

      <p className="mt-8 text-xs text-muted-foreground">
        Accounts are created by the platform administrator. Forgot your password? Ask an
        administrator to reset it.
      </p>
    </AuthLayout>
  )
}
