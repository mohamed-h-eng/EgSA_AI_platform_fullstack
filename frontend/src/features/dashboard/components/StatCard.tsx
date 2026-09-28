import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

import { cn } from '@shared/lib/utils'
import { Skeleton } from '@shared/ui/skeleton'

interface StatCardProps {
  label: string
  value: number | undefined
  icon: LucideIcon
  to?: string
  tone?: 'primary' | 'ai'
}

export function StatCard({ label, value, icon: Icon, to, tone = 'primary' }: StatCardProps) {
  const body = (
    <>
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-lg',
          tone === 'ai' ? 'bg-ai/10 text-ai' : 'bg-primary-light text-primary',
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-muted-foreground">{label}</span>
        {value === undefined ? (
          <Skeleton className="mt-1 h-7 w-12" />
        ) : (
          <span className="block text-2xl font-bold text-navy tabular-nums">
            {value.toLocaleString()}
          </span>
        )}
      </span>
    </>
  )
  const className = 'flex items-center gap-4 rounded-lg border bg-surface p-5 transition-colors'
  return to ? (
    <Link
      to={to}
      className={cn(
        className,
        'hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}
