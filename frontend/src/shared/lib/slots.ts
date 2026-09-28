import { createContext, type ReactNode, useContext } from 'react'

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

export interface Slots {
  projectTabs: ProjectTabSlot[]
}

export const SlotsContext = createContext<Slots>({ projectTabs: [] })

export function useSlot<K extends keyof Slots>(name: K): Slots[K] {
  return useContext(SlotsContext)[name]
}
