import { createBrowserRouter, type RouteObject } from 'react-router'

import { AuthenticatedShell } from './AuthenticatedShell'
import { features } from './feature-registry'
import { RequireAuth } from './guards/RequireAuth'
import { RouteError } from './RouteError'

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
      ...features.flatMap((f) => f.routes),
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
