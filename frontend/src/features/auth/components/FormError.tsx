import { AlertCircle } from 'lucide-react'

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md bg-danger/10 px-3 py-2.5 text-sm text-danger"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  )
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-danger">
      {message}
    </p>
  )
}
