import { useQuery } from '@tanstack/react-query'

import * as api from './dashboard.api'

export const dashboardKeys = { summary: () => ['dashboard', 'summary'] as const }

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: api.getDashboardSummary,
    // Always fresh when the user comes back to the dashboard.
    refetchOnMount: 'always',
  })
}
