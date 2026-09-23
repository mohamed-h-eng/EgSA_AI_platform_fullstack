import { authFeature } from '@features/auth'
import { dashboardFeature } from '@features/dashboard'
import { notificationsFeature } from '@features/notifications'
import type { FeatureManifest, NavItem } from '@shared/types/feature'

/**
 * Enabled features. Adding a feature = create `src/features/<name>/` and add ONE line here.
 * See .agent/workflows/add-feature.md.
 */
export const features: FeatureManifest[] = [
  authFeature,
  dashboardFeature,
  notificationsFeature,
  // chatFeature, documentsFeature, projectsFeature, usersFeature, settingsFeature
]

export const navItems: NavItem[] = features
  .flatMap((f) => f.nav ?? [])
  .sort((a, b) => a.order - b.order)
