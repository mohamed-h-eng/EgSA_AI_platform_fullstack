import { NavLink } from 'react-router'

import { cn } from '@shared/lib/utils'
import type { NavItem } from '@shared/types/feature'

import { BrandMark } from './BrandMark'

interface SidebarProps {
  items: NavItem[]
}

export function Sidebar({ items }: SidebarProps) {
  const main = items.filter((i) => (i.section ?? 'main') === 'main')
  const admin = items.filter((i) => i.section === 'admin')

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-surface px-4 py-6">
      <BrandMark />

      <nav aria-label="Main navigation" className="mt-8 flex flex-1 flex-col gap-6">
        <NavGroup items={main} />
        {admin.length > 0 && <NavGroup title="Administration" items={admin} />}
      </nav>

      <footer className="mt-6 px-2 text-xs text-muted-foreground">
        <p className="leading-snug font-semibold text-navy">
          Space
          <br />
          for a Brighter
          <br />
          Egypt
        </p>
        <div className="my-2 h-px w-12 bg-border" />
        <p className="tracking-wide">PEOPLE | KNOWLEDGE | IMPACT</p>
      </footer>
    </aside>
  )
}

function NavGroup({ title, items }: { title?: string; items: NavItem[] }) {
  return (
    <div>
      {title && (
        <p className="mb-2 px-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {title}
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {items.map(({ path, label, icon: Icon }) => (
          <li key={path}>
            <NavLink
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200',
                  isActive
                    ? 'bg-primary-light text-primary'
                    : 'text-navy hover:bg-primary-light/60',
                )
              }
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
