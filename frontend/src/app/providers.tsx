import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { AuthProvider } from '@features/auth'
import { NotificationsToaster } from '@features/notifications'
import { ApiError } from '@shared/api/http'
import { TooltipProvider } from '@shared/ui/tooltip'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Don't retry client errors (401/403/404…); they won't fix themselves.
      retry: (count, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider delayDuration={300}>
          {children}
          <NotificationsToaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
