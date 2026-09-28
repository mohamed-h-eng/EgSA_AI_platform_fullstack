import { ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { matchPath, NavLink, useLocation } from 'react-router'

import { cn } from '@shared/lib/utils'
import type { NavItem } from '@shared/types/feature'

import { BrandMark } from './BrandMark'

export interface SidebarParts {
  /** Primary action under the brand (the "New chat" button). */
  primaryAction?: (compact: boolean, onNavigate?: () => void) => ReactNode
  /** Blocks between the navigation and the footer (e.g. recent chats). Hidden when compact. */
  sections?: (onNavigate?: () => void) => ReactNode
  /** Bottom of the sidebar (the account menu). */
  footer?: (compact: boolean, onNavigate?: () => void) => ReactNode
}

interface SidebarContentProps extends SidebarParts {
  navItems: NavItem[]
  compact: boolean
  /** Desktop only: collapse/expand toggle. */
  onToggleCompact?: () => void
  /** Mobile drawer: close after following a link. */
  onNavigate?: () => void
}

/**
 * Claude-style sidebar (workflow 11). Top: brand, New chat, main pages, a small
 * Administration group. Middle: feature sections (recent chats), scrolling on their own.
 * Bottom: account menu. `compact` is the icon rail.
 */
export function SidebarContent({
  navItems,
  compact,
  onToggleCompact,
  onNavigate,
  primaryAction,
  sections,
  footer,
}: SidebarContentProps) {
  const main = navItems.filter((i) => (i.section ?? 'main') === 'main')
  const admin = navItems.filter((i) => i.section === 'admin')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn('flex shrink-0 flex-col gap-3 pb-3', compact ? 'items-center' : '')}>
        <div
          className={cn('flex items-center gap-2', compact ? 'flex-col' : 'justify-between px-1')}
        >
          <BrandMark compact={compact} />
          {onToggleCompact && (
            <button
              type="button"
              onClick={onToggleCompact}
              aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
              title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-primary-light/60 hover:text-navy focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {compact ? (
                <PanelLeftOpen className="size-4" aria-hidden />
              ) : (
                <PanelLeftClose className="size-4" aria-hidden />
              )}
            </button>
          )}
        </div>

        {primaryAction?.(compact, onNavigate)}

        <nav aria-label="Main navigation" className="flex flex-col gap-3">
          <NavList items={main} compact={compact} onNavigate={onNavigate} />
          {admin.length > 0 &&
            (compact ? (
              <div>
                <div className="mx-auto mb-2 h-px w-6 bg-border" aria-hidden />
                <NavList items={admin} compact onNavigate={onNavigate} dense />
              </div>
            ) : (
              <AdminGroup items={admin} onNavigate={onNavigate} />
            ))}
        </nav>
      </div>

      {/* Middle: scrolls on its own; hidden in the icon rail. */}
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto border-t px-1 pt-3">
        {!compact && sections?.(onNavigate)}
      </div>

      {footer && <div className="shrink-0 border-t pt-2">{footer(compact, onNavigate)}</div>}
    </div>
  )
}

function NavList({
  items,
  compact,
  dense = false,
  onNavigate,
}: {
  items: NavItem[]
  compact: boolean
  dense?: boolean
  onNavigate?: () => void
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map(({ path, label, icon: Icon }) => (
        <li key={path}>
          <NavLink
            to={path}
            end={path === '/'}
            title={compact ? label : undefined}
            aria-label={compact ? label : undefined}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                compact ? 'mx-auto size-9 justify-center' : 'px-3',
                !compact && (dense ? 'py-1.5' : 'py-2'),
                isActive ? 'bg-primary-light text-primary' : 'text-navy hover:bg-primary-light/60',
              )
            }
          >
            <Icon className={cn('shrink-0', dense ? 'size-4' : 'size-5')} aria-hidden />
            {!compact && label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

const ADMIN_OPEN_KEY = 'egsa.sidebar.admin.open'

/** "Administration" is collapsed by default; it opens itself while an admin page is shown,
 *  and remembers when the user opens it. */
function AdminGroup({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const [stored, setStored] = useState(() => {
    try {
      return localStorage.getItem(ADMIN_OPEN_KEY) === '1'
    } catch {
      return false
    }
  })
  const onAdminPage = items.some((i) => matchPath({ path: i.path, end: false }, pathname))
  const open = stored || onAdminPage

  const toggle = () => {
    const next = !open
    setStored(next)
    try {
      localStorage.setItem(ADMIN_OPEN_KEY, next ? '1' : '0')
    } catch {
      // not persisted; still toggles for this visit
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="sidebar-admin-items"
        className="flex w-full items-center gap-1 rounded-md px-3 py-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase hover:text-navy focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Administration
        <ChevronRight
          className={cn('size-3 transition-transform duration-200', open && 'rotate-90')}
          aria-hidden
        />
      </button>
      {open && (
        <div id="sidebar-admin-items" className="mt-1">
          <NavList items={items} compact={false} onNavigate={onNavigate} dense />
        </div>
      )}
    </div>
  )
}
