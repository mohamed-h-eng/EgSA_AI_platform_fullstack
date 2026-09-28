import { auditFeature } from '@features/audit'
import { authFeature } from '@features/auth'
import { chatFeature } from '@features/chat'
import { dashboardFeature } from '@features/dashboard'
import { documentsFeature } from '@features/documents'
import { notificationsFeature } from '@features/notifications'
import { projectsFeature } from '@features/projects'
import { settingsFeature } from '@features/settings'
import { usersFeature } from '@features/users'
import type { Slots } from '@shared/lib/slots'
import type { FeatureManifest, NavItem } from '@shared/types/feature'

/**
 * Enabled features. Adding a feature = create `src/features/<name>/` and add ONE line here.
 * See .agent/workflows/add-feature.md.
 */
export const features: FeatureManifest[] = [
  auditFeature,
  authFeature,
  chatFeature,
  dashboardFeature,
  documentsFeature,
  notificationsFeature,
  projectsFeature,
  settingsFeature,
  usersFeature,
]

export const navItems: NavItem[] = features
  .flatMap((f) => f.nav ?? [])
  .sort((a, b) => a.order - b.order)

export const slots: Slots = {
  projectTabs: features
    .flatMap((f) => f.slots?.projectTabs ?? [])
    .sort((a, b) => a.order - b.order),
}
