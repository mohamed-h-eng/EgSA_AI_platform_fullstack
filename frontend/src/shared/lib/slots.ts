import { type ComponentType, createContext, type ReactNode, useContext } from 'react'

import type { PermissionCode } from '@shared/types/feature'

/**
 * Extension slots: lets one feature contribute UI to another WITHOUT importing it
 * (e.g. documents adds a tab to the project page; projects never imports documents,
 * which would create a feature cycle). Features declare contributions in their manifest;
 * the app collects them from the registry and provides them via <SlotsProvider>.
 */

export interface ProjectTabContext {
  projectId: string
  projectCode: string
  /** False for project Viewers (read-only). */
  canContribute: boolean
}

export interface ProjectTabSlot {
  id: string
  label: string
  order: number
  render: (ctx: ProjectTabContext) => ReactNode
}

/** A block in the app sidebar between the navigation and the account menu (e.g. recent chats).
 *  Hidden while the sidebar is collapsed to its icon rail. */
export interface SidebarSectionSlot {
  id: string
  order: number
  permission?: PermissionCode
  /** `onNavigate` closes the mobile drawer after a link is followed. */
  Component: ComponentType<{ onNavigate?: () => void }>
}

export interface Slots {
  projectTabs: ProjectTabSlot[]
  sidebarSections: SidebarSectionSlot[]
}

export const SlotsContext = createContext<Slots>({ projectTabs: [], sidebarSections: [] })

export function useSlot<K extends keyof Slots>(name: K): Slots[K] {
  return useContext(SlotsContext)[name]
}
