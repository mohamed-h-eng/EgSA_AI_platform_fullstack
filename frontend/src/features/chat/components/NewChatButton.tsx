import { Plus } from 'lucide-react'
import { Link } from 'react-router'

import { cn } from '@shared/lib/utils'

/**
 * Sidebar primary action: a plus in a filled circle + label. The row itself never gets a
 * background or a focus box (that looked like an active nav tab); hover and keyboard focus
 * only restyle the circle. `compact` shows the circle alone for the collapsed rail.
 */
export function NewChatButton({
  compact = false,
  onNavigate,
}: {
  compact?: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      to="/chat"
      onClick={onNavigate}
      title={compact ? 'New chat' : undefined}
      aria-label={compact ? 'New chat' : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-md text-sm font-medium text-navy outline-none',
        compact ? 'justify-center' : 'px-2 py-1',
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors group-hover:bg-primary/85 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2">
        <Plus className="size-4" aria-hidden />
      </span>
      {!compact && <span className="group-hover:text-primary">New chat</span>}
    </Link>
  )
}
