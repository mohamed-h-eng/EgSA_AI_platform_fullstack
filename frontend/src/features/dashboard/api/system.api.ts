import { ApiError, http } from '@shared/api/http'

import type { HealthStatus } from '../model/types'

export async function getHealth(): Promise<HealthStatus> {
  try {
    return await http<HealthStatus>('/health')
  } catch (error) {
    // 503 = backend is up but the database is not.
    if (error instanceof ApiError && error.status === 503) {
      return { status: 'degraded', database: 'error' }
    }
    throw error
  }
}
