import type { PermissionCode } from '@shared/types/feature'

import { useAuth } from './useAuth'

/**
 * UI-only check: hides actions the user can't perform. The backend enforces the same
 * permission codes (ADR-04), so never rely on this for security.
 */
export function usePermission(code: PermissionCode | undefined): boolean {
  const { user } = useAuth()
  if (!code) return true
  return user?.permissions.includes(code) ?? false
}

export function usePermissionChecker(): (code: PermissionCode | undefined) => boolean {
  const { user } = useAuth()
  return (code) => !code || (user?.permissions.includes(code) ?? false)
}
