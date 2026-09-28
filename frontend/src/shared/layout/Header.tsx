import { Menu } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import type { NavItem } from '@shared/types/feature'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@shared/ui/sheet'

import { GlobalSearch, type SearchTarget } from './GlobalSearch'
import { SidebarNav } from './Sidebar'

interface HeaderProps {
  navItems: NavItem[]
  searchTargets: SearchTarget[]
  /** Right-hand slot (user menu). */
  actions?: ReactNode
}

export function Header({ navItems, searchTargets, actions }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-surface px-4 md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rounded-md p-2 text-navy hover:bg-primary-light/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <p className="hidden truncate text-base font-semibold text-navy lg:block">
          EgSA AI Engineering Platform
        </p>
        <GlobalSearch targets={searchTargets} />
      </div>
      <div className="flex items-center gap-3">{actions}</div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex w-72 flex-col px-4 py-6">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
          <SidebarNav items={navItems} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  )
}
