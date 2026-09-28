import type { ReactNode } from 'react'
import { Outlet } from 'react-router'

import type { NavItem } from '@shared/types/feature'

import type { SearchTarget } from './GlobalSearch'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

interface AppShellProps {
  navItems: NavItem[]
  searchTargets?: SearchTarget[]
  headerActions?: ReactNode
  /** Rendered instead of the route outlet (e.g. the in-shell "page not found"). */
  children?: ReactNode
}

export function AppShell({ navItems, searchTargets = [], headerActions, children }: AppShellProps) {
  return (
    <div className="flex h-full">
      <Sidebar items={navItems} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header navItems={navItems} searchTargets={searchTargets} actions={headerActions} />
        {/* Padding is mirrored by full-bleed pages (chat) via the --page-pad-* variables. */}
        <main className="flex-1 overflow-y-auto px-4 py-6 [--page-pad-x:1rem] [--page-pad-y:1.5rem] md:px-8 md:py-8 md:[--page-pad-x:2rem] md:[--page-pad-y:2rem]">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}
