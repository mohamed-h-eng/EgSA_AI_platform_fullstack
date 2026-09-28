import type { ReactNode } from 'react'

import { cn } from '@shared/lib/utils'

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'ai'

const TONES: Record<StatusTone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-[#9a6412]',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-primary-light text-primary',
  neutral: 'bg-muted text-muted-foreground',
  ai: 'bg-ai/10 text-ai',
}

/** Pill badge with a dot (design.md §22). The text always carries the meaning, not just color. */
export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}
