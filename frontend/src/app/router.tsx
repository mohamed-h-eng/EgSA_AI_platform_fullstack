import { createBrowserRouter, type RouteObject } from 'react-router'

import type { FeatureRouteHandle } from '@shared/types/feature'

import { AuthenticatedShell } from './AuthenticatedShell'
import { features } from './feature-registry'
import { RequireAuth } from './guards/RequireAuth'
import { RequirePermission } from './guards/RequirePermission'
import { RouteError } from './RouteError'

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
      ...features.flatMap((f) => f.routes).map(withPermissionGuard),
      {
        path: '*',
        loader: () => {
          throw new Response('', { status: 404 })
        },
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
