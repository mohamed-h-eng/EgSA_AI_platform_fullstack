import type { LucideIcon } from 'lucide-react'
import type { RouteObject } from 'react-router'

/** Permission codes, e.g. `documents:upload`. Enforced by the backend; the UI only hides actions. */
export type PermissionCode = `${string}:${string}`

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  /** Lower comes first. */
  order: number
  permission?: PermissionCode
  section?: 'main' | 'admin'
}

/**
 * Contract every feature exports from its `manifest.ts`.
 * The router and sidebar are generated from the list in `app/feature-registry.ts`.
 */
export interface FeatureManifest {
  id: string
  /** Routes rendered inside the authenticated AppShell. */
  routes: RouteObject[]
  /** Routes rendered outside the AppShell without authentication (e.g. /login). */
  publicRoutes?: RouteObject[]
  /** Authenticated routes rendered WITHOUT the AppShell (e.g. /change-password). */
  fullscreenRoutes?: RouteObject[]
  nav?: NavItem[]
}
