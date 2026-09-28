import { Settings } from 'lucide-react'

import type { FeatureManifest } from '@shared/types/feature'

export const settingsFeature: FeatureManifest = {
  id: 'settings',
  routes: [
    {
      path: 'settings',
      lazy: async () => ({ Component: (await import('./pages/ProfilePage')).ProfilePage }),
    },
    {
      path: 'admin/settings',
      handle: { permission: 'settings:manage' },
      lazy: async () => ({
        Component: (await import('./pages/AdminSettingsPage')).AdminSettingsPage,
      }),
    },
  ],
  nav: [
    {
      label: 'Settings',
      path: '/admin/settings',
      icon: Settings,
      order: 95,
      permission: 'settings:manage',
      section: 'admin',
    },
  ],
}
