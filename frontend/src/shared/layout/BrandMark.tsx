import { cn } from '@shared/lib/utils'
import { EgsaLogo } from '@shared/ui/egsa-logo'

/** Sidebar brand block: the static EgSA logo + the product name (design-system.md). */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', compact && 'justify-center')}>
      <EgsaLogo variant="mark" label="" className={compact ? 'h-7' : 'h-8'} />
      {compact ? (
        <span className="sr-only">EgSA AI Platform</span>
      ) : (
        <p className="min-w-0 truncate text-sm font-semibold text-navy">EgSA AI Platform</p>
      )}
    </div>
  )
}
