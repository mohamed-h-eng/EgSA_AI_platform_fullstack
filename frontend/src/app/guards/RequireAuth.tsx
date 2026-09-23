import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuth } from '@features/auth'
import { FullPageLoader } from '@shared/layout/FullPageLoader'

interface RequireAuthProps {
  children?: ReactNode
  /** Only the change-password screen may be shown while a password change is pending (D9). */
  allowPendingPasswordChange?: boolean
}

export function RequireAuth({ children, allowPendingPasswordChange = false }: RequireAuthProps) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader label="Restoring your session…" />

  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  if (user.must_change_password && !allowPendingPasswordChange) {
    return <Navigate to="/change-password" replace />
  }

  return children ?? <Outlet />
}
