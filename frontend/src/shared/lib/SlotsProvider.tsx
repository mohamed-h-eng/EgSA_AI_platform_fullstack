import type { ReactNode } from 'react'

import { type Slots, SlotsContext } from './slots'

export function SlotsProvider({ slots, children }: { slots: Slots; children: ReactNode }) {
  return <SlotsContext.Provider value={slots}>{children}</SlotsContext.Provider>
}
