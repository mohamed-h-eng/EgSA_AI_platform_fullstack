import { FileText } from 'lucide-react'

import type { FeatureManifest } from '@shared/types/feature'

import { DocumentLibrary } from './components/DocumentLibrary'

const page = async () => ({ Component: (await import('./pages/DocumentsPage')).DocumentsPage })

export const documentsFeature: FeatureManifest = {
  id: 'documents',
  routes: [
    { path: 'documents', handle: { permission: 'documents:read' }, lazy: page },
    { path: 'documents/:documentId', handle: { permission: 'documents:read' }, lazy: page },
  ],
  nav: [
    {
      label: 'Documents',
      path: '/documents',
      icon: FileText,
      order: 30,
      permission: 'documents:read',
    },
  ],
  slots: {
    // Contributed to the project page without the projects feature importing documents.
    projectTabs: [
      {
        id: 'documents',
        label: 'Documents',
        order: 10,
        render: ({ projectId, canContribute }) => (
          <DocumentLibrary projectId={projectId} canContribute={canContribute} />
        ),
      },
    ],
  },
}
