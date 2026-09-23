export interface HealthStatus {
  status: 'ok' | 'degraded'
  database: 'ok' | 'error'
}
