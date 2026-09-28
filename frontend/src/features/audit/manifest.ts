import { ScrollText } from 'lucide-react'

import type { FeatureManifest } from '@shared/types/feature'

export const auditFeature: FeatureManifest = {
  id: 'audit',
  routes: [
    {
      path: 'admin/audit',
      handle: { permission: 'audit:read' },
      lazy: async () => ({ Component: (await import('./pages/AuditLogPage')).AuditLogPage }),
    },
  ],
  nav: [
    {
      label: 'Audit log',
      path: '/admin/audit',
      icon: ScrollText,
      order: 96,
      permission: 'audit:read',
      section: 'admin',
    },
  ],
}
