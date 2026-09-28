import { FolderKanban } from 'lucide-react'

import type { FeatureManifest } from '@shared/types/feature'

export const projectsFeature: FeatureManifest = {
  id: 'projects',
  routes: [
    {
      path: 'projects',
      handle: { permission: 'projects:read' },
      lazy: async () => ({ Component: (await import('./pages/ProjectsPage')).ProjectsPage }),
    },
    {
      path: 'projects/:projectId',
      handle: { permission: 'projects:read' },
      lazy: async () => ({
        Component: (await import('./pages/ProjectDetailPage')).ProjectDetailPage,
      }),
    },
  ],
  nav: [
    {
      label: 'Projects',
      path: '/projects',
      icon: FolderKanban,
      order: 30,
      permission: 'projects:read',
    },
  ],
}
