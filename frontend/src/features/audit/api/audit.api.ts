import { http } from '@shared/api/http'
import type { Page } from '@shared/types/api'

import type { AuditEntry, AuditFilters } from '../model/types'

export const AUDIT_PAGE_SIZE = 25

/** Local calendar day → ISO instant (start of that day, or of the next day for `to`). */
function dayBoundary(day: string, nextDay = false): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d + (nextDay ? 1 : 0)).toISOString()
}

export function listAuditLogs(filters: AuditFilters): Promise<Page<AuditEntry>> {
  const params = new URLSearchParams({
    page: String(filters.page),
    page_size: String(AUDIT_PAGE_SIZE),
  })
  if (filters.actor.trim()) params.set('actor', filters.actor.trim())
  if (filters.action) params.set('action', filters.action)
  if (filters.from) params.set('from', dayBoundary(filters.from))
  if (filters.to) params.set('to', dayBoundary(filters.to, true))
  return http(`/admin/audit-logs?${params}`)
}

export function listAuditActions(): Promise<string[]> {
  return http('/admin/audit-logs/actions')
}
