import { Badge } from '@shared/ui/badge'
import { cn } from '@shared/lib/utils'

export type ServiceState = 'ok' | 'error' | 'checking'

const LABEL: Record<ServiceState, string> = {
  ok: 'Connected',
  error: 'Unavailable',
  checking: 'Checking…',
}

const STYLE: Record<ServiceState, string> = {
  ok: 'bg-success/10 text-success',
  error: 'bg-danger/10 text-danger',
  checking: 'bg-muted text-muted-foreground',
}

export function StatusRow({ name, state }: { name: string; state: ServiceState }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm font-medium text-navy">{name}</span>
      <Badge variant="outline" className={cn('rounded-full border-0 px-2.5', STYLE[state])}>
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
        {LABEL[state]}
      </Badge>
    </div>
  )
}
