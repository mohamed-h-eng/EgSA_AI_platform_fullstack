import type { ReactNode } from 'react'
import { Outlet } from 'react-router'

import type { NavItem } from '@shared/types/feature'

import { Header } from './Header'
import { Sidebar } from './Sidebar'

interface AppShellProps {
  navItems: NavItem[]
  headerActions?: ReactNode
}

export function AppShell({ navItems, headerActions }: AppShellProps) {
  return (
    <div className="flex h-full">
      <Sidebar items={navItems} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header actions={headerActions} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
