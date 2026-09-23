import type { ReactNode } from 'react'
import { Outlet } from 'react-router'

import { usePermission } from '@features/auth'
import type { PermissionCode } from '@shared/types/feature'

/** Route-level permission gate. Renders a not-authorized message rather than redirecting. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionCode
  children?: ReactNode
}) {
  if (!usePermission(permission)) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Not authorized</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have permission to view this page.
        </p>
      </div>
    )
  }
  return children ?? <Outlet />
}
