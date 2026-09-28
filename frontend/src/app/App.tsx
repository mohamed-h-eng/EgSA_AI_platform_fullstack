import { RouterProvider } from 'react-router/dom'

import { SlotsProvider } from '@shared/lib/SlotsProvider'

import { slots } from './feature-registry'
import { Providers } from './providers'
import { router } from './router'

export function App() {
  return (
    <Providers>
      <SlotsProvider slots={slots}>
        <RouterProvider router={router} />
      </SlotsProvider>
    </Providers>
  )
}
