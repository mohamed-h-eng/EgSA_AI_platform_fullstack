import { createBrowserRouter, type RouteObject } from 'react-router'

import type { FeatureRouteHandle } from '@shared/types/feature'

import { AuthenticatedShell } from './AuthenticatedShell'
import { features } from './feature-registry'
import { RequireAuth } from './guards/RequireAuth'
import { RequirePermission } from './guards/RequirePermission'
import { NotFoundPage, RouteError } from './RouteError'

/** Wrap routes that declare `handle.permission` in a permission guard. */
export function withPermissionGuard(route: RouteObject): RouteObject {
  const permission = (route.handle as FeatureRouteHandle | undefined)?.permission
  return permission
    ? { element: <RequirePermission permission={permission} />, children: [route] }
    : route
}

export const routes: RouteObject[] = [
  // Public: /login
  ...features.flatMap((f) => f.publicRoutes ?? []),

  // Authenticated, no shell: /change-password (reachable while a password change is pending)
  {
    element: <RequireAuth allowPendingPasswordChange />,
    errorElement: <RouteError />,
    children: features.flatMap((f) => f.fullscreenRoutes ?? []),
  },

  // Authenticated app inside the shell
  {
    path: '/',
    element: (
      <RequireAuth>
        <AuthenticatedShell />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      {
        // Page errors and unknown URLs render INSIDE the shell (backlog B1). Unknown URLs are
        // a plain element (no throwing loader), so RequireAuth still redirects signed-out users.
        errorElement: <RouteError />,
        children: [
          ...features.flatMap((f) => f.routes).map(withPermissionGuard),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
