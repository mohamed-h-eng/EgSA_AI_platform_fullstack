import type { ReactNode } from 'react'

import type { PermissionCode } from '@shared/types/feature'

import { usePermission } from '../hooks/usePermission'

interface CanProps {
  permission: PermissionCode
  children: ReactNode
  fallback?: ReactNode
}

/** `<Can permission="documents:upload"><UploadButton /></Can>` */
export function Can({ permission, children, fallback = null }: CanProps) {
  return usePermission(permission) ? children : fallback
}
