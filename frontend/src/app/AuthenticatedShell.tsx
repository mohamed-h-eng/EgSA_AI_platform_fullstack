import { UserMenu, usePermissionChecker } from '@features/auth'
import { AppShell } from '@shared/layout/AppShell'

import { navItems } from './feature-registry'

/** AppShell with navigation filtered by the signed-in user's permissions. */
export function AuthenticatedShell() {
  const can = usePermissionChecker()
  return (
    <AppShell
      navItems={navItems.filter((item) => can(item.permission))}
      headerActions={<UserMenu />}
    />
  )
}
