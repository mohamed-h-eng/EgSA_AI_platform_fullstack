import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { AuditFilters } from '../model/types'
import * as api from './audit.api'

export const auditKeys = {
  list: (filters: AuditFilters) => ['audit', 'list', filters] as const,
  actions: () => ['audit', 'actions'] as const,
}

export function useAuditLogs(filters: AuditFilters, enabled = true) {
  return useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: () => api.listAuditLogs(filters),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useAuditActions() {
  return useQuery({
    queryKey: auditKeys.actions(),
    queryFn: api.listAuditActions,
    staleTime: Infinity,
  })
}
