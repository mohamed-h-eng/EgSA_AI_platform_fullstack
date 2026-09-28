import { UserMenu, usePermissionChecker } from '@features/auth'
import { NewChatButton } from '@features/chat'
import { AppShell } from '@shared/layout/AppShell'
import type { SearchTarget } from '@shared/layout/GlobalSearch'
import type { PermissionCode } from '@shared/types/feature'

import { navItems, slots } from './feature-registry'

/** Search targets: list pages that accept `?q=` (first one is the Enter default). */
const SEARCH_TARGETS: (SearchTarget & { permission: PermissionCode })[] = [
  { label: 'Documents', path: '/documents', permission: 'documents:read' },
  { label: 'Projects', path: '/projects', permission: 'projects:read' },
]

/** AppShell assembled from the features, filtered by the signed-in user's permissions. */
export function AuthenticatedShell() {
  const can = usePermissionChecker()
  const sections = slots.sidebarSections.filter((s) => can(s.permission))

  return (
    <AppShell
      navItems={navItems.filter((item) => can(item.permission))}
      searchTargets={SEARCH_TARGETS.filter((t) => can(t.permission))}
      primaryAction={
        can('chat:use')
          ? (compact, onNavigate) => <NewChatButton compact={compact} onNavigate={onNavigate} />
          : undefined
      }
      sections={(onNavigate) =>
        sections.map(({ id, Component }) => <Component key={id} onNavigate={onNavigate} />)
      }
      footer={(compact, onNavigate) => <UserMenu compact={compact} onNavigate={onNavigate} />}
    />
  )
}
