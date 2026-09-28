import { NavLink } from 'react-router'

import { cn } from '@shared/lib/utils'
import type { NavItem } from '@shared/types/feature'

import { BrandMark } from './BrandMark'

interface SidebarProps {
  items: NavItem[]
}

/**
 * Desktop (lg+): full sidebar. Tablet (md–lg): icon rail. Mobile: hidden; the header's menu
 * button opens <SidebarNav> in a drawer instead.
 */
export function Sidebar({ items }: SidebarProps) {
  return (
    <aside className="hidden shrink-0 flex-col border-r bg-surface py-6 md:flex md:w-16 md:px-2 lg:w-60 lg:px-4">
      <SidebarNav items={items} compactOnTablet />
    </aside>
  )
}

interface SidebarNavProps {
  items: NavItem[]
  /** Show icons only between md and lg. */
  compactOnTablet?: boolean
  onNavigate?: () => void
}

export function SidebarNav({ items, compactOnTablet = false, onNavigate }: SidebarNavProps) {
  const main = items.filter((i) => (i.section ?? 'main') === 'main')
  const admin = items.filter((i) => i.section === 'admin')
  // Hidden only in the tablet rail; visible on desktop and inside the mobile drawer.
  const label = compactOnTablet ? 'md:sr-only lg:not-sr-only' : undefined

  return (
    <>
      <BrandMark compact={compactOnTablet} />

      <nav aria-label="Main navigation" className="mt-8 flex flex-1 flex-col gap-6">
        <NavGroup items={main} labelClass={label} onNavigate={onNavigate} />
        {admin.length > 0 && (
          <NavGroup
            title="Administration"
            items={admin}
            labelClass={label}
            onNavigate={onNavigate}
          />
        )}
      </nav>

      <footer
        className={cn(
          'mt-6 px-2 text-xs text-muted-foreground',
          compactOnTablet && 'md:hidden lg:block',
        )}
      >
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
    </>
  )
}

function NavGroup({
  title,
  items,
  labelClass,
  onNavigate,
}: {
  title?: string
  items: NavItem[]
  labelClass?: string
  onNavigate?: () => void
}) {
  return (
    <div>
      {title && (
        <p
          className={cn(
            'mb-2 px-3 text-xs font-medium tracking-wider text-muted-foreground uppercase',
            labelClass,
          )}
        >
          {title}
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {items.map(({ path, label, icon: Icon }) => (
          <li key={path}>
            <NavLink
              to={path}
              end={path === '/'}
              title={label}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  labelClass && 'md:justify-center lg:justify-start',
                  isActive
                    ? 'bg-primary-light text-primary'
                    : 'text-navy hover:bg-primary-light/60',
                )
              }
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className={labelClass}>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
