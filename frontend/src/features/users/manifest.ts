import { Users } from 'lucide-react'

import type { FeatureManifest } from '@shared/types/feature'

/**
 * Admin-only page, gated by `users:create` rather than `users:read`: engineers and leads hold
 * users:read (needed for member pickers in phase 04) but must not see user administration.
 */
export const usersFeature: FeatureManifest = {
  id: 'users',
  routes: [
    {
      path: 'admin/users',
      handle: { permission: 'users:create' },
      lazy: async () => ({ Component: (await import('./pages/UsersPage')).UsersPage }),
    },
  ],
  nav: [
    {
      label: 'Users & Access',
      path: '/admin/users',
      icon: Users,
      order: 90,
      permission: 'users:create',
      section: 'admin',
    },
  ],
}
