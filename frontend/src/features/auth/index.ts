// Public API of the auth feature. Other code may import ONLY from this file.
export { AuthProvider } from './components/AuthProvider'
export { Can } from './components/Can'
export { UserMenu } from './components/UserMenu'
export { useAuth } from './hooks/useAuth'
export { usePermission, usePermissionChecker } from './hooks/usePermission'
export { authFeature } from './manifest'
export type { AuthStatus, AuthUser } from './model/types'
export { roleLabel } from './model/types'
