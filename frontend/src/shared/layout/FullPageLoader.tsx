import { Loader2 } from 'lucide-react'

export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex h-full items-center justify-center gap-3 text-muted-foreground"
    >
      <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  )
}
