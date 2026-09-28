import { Menu } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Outlet } from 'react-router'

import { cn } from '@shared/lib/utils'
import type { NavItem } from '@shared/types/feature'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@shared/ui/sheet'

import { BrandMark } from './BrandMark'
import { GlobalSearch, type SearchTarget } from './GlobalSearch'
import { SidebarContent, type SidebarParts } from './Sidebar'

const COLLAPSED_KEY = 'egsa.sidebar.collapsed'

function initialCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(COLLAPSED_KEY)
    if (stored !== null) return stored === '1'
  } catch {
    // storage unavailable (private mode): fall through to the default
  }
  // Tablets start with the icon rail.
  return typeof window !== 'undefined' && window.innerWidth < 1024
}

interface AppShellProps extends SidebarParts {
  navItems: NavItem[]
  searchTargets?: SearchTarget[]
  /** Rendered instead of the route outlet (tests, in-shell errors). */
  children?: ReactNode
}

/**
 * One sidebar for the whole app, no top header on desktop (workflow 11, D18).
 * Mobile gets a slim bar with a menu button that opens the full sidebar in a drawer.
 */
export function AppShell({
  navItems,
  searchTargets = [],
  primaryAction,
  sections,
  footer,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1')
      } catch {
        // not persisted; still toggles for this visit
      }
      return !c
    })
  const closeMobile = () => setMobileOpen(false)
  const parts = { primaryAction, sections, footer }

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside
        aria-label="Sidebar"
        className={cn(
          'hidden shrink-0 border-r bg-surface py-4 transition-[width] duration-200 md:block',
          collapsed ? 'w-16 px-2' : 'w-64 px-3',
        )}
      >
        <SidebarContent
          navItems={navItems}
          compact={collapsed}
          onToggleCompact={toggleCollapsed}
          {...parts}
        />
      </aside>

      {/* Mobile: slim bar + drawer with the full sidebar (recent chats included). */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-surface px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-navy hover:bg-primary-light/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Open navigation"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <BrandMark />
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 px-3 py-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation and recent chats</SheetDescription>
          <SidebarContent navItems={navItems} compact={false} onNavigate={closeMobile} {...parts} />
        </SheetContent>
      </Sheet>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 [--page-pad-x:1rem] [--page-pad-y:1.5rem] md:px-8 md:py-8 md:[--page-pad-x:2rem] md:[--page-pad-y:2rem]">
        {children ?? <Outlet />}
      </main>

      {/* No visible search entry (user request); Ctrl+K still opens the search dialog. */}
      <GlobalSearch targets={searchTargets} open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
