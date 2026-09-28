import { http } from '@shared/api/http'

import type { DashboardSummary } from '../model/types'

export function getDashboardSummary(): Promise<DashboardSummary> {
  return http('/dashboard/summary')
}
