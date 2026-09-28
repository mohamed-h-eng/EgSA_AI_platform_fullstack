import { UserMenu, usePermissionChecker } from '@features/auth'
import { AppShell } from '@shared/layout/AppShell'
import type { SearchTarget } from '@shared/layout/GlobalSearch'
import type { PermissionCode } from '@shared/types/feature'

import { navItems } from './feature-registry'

/** Header search targets: list pages that accept `?q=` (first one is the Enter default). */
const SEARCH_TARGETS: (SearchTarget & { permission: PermissionCode })[] = [
  { label: 'Documents', path: '/documents', permission: 'documents:read' },
  { label: 'Projects', path: '/projects', permission: 'projects:read' },
]

/** AppShell with navigation and search filtered by the signed-in user's permissions. */
export function AuthenticatedShell() {
  const can = usePermissionChecker()
  return (
    <AppShell
      navItems={navItems.filter((item) => can(item.permission))}
      searchTargets={SEARCH_TARGETS.filter((t) => can(t.permission))}
      headerActions={<UserMenu />}
    />
  )
}
