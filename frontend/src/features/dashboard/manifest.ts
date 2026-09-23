import { LayoutDashboard } from 'lucide-react'

import type { FeatureManifest } from '@shared/types/feature'

export const dashboardFeature: FeatureManifest = {
  id: 'dashboard',
  routes: [
    {
      index: true,
      lazy: async () => ({ Component: (await import('./pages/DashboardPage')).DashboardPage }),
    },
  ],
  nav: [{ label: 'Dashboard', path: '/', icon: LayoutDashboard, order: 0 }],
}
