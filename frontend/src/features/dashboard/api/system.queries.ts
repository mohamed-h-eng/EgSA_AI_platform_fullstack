import { useQuery } from '@tanstack/react-query'

import { getHealth } from './system.api'

export const systemKeys = {
  all: ['system'] as const,
  health: () => [...systemKeys.all, 'health'] as const,
}

export function useHealth() {
  return useQuery({
    queryKey: systemKeys.health(),
    queryFn: getHealth,
    retry: false,
    refetchInterval: 30_000,
  })
}
