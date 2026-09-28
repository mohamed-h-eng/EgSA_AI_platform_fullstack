/** Mirrors backend `schemas/admin.py::AuditLogOut`. */
export interface AuditEntry {
  id: string
  action: string
  actor: { id: string; full_name: string; email: string } | null
  target_type: string | null
  target_id: string | null
  meta: Record<string, unknown>
  ip: string | null
  created_at: string
}

export interface AuditFilters {
  actor: string
  /** Exact action or a prefix such as "document". */
  action: string
  /** yyyy-mm-dd (local), inclusive */
  from: string
  to: string
  page: number
}

/** "document.upload" → "Document · upload" */
export function actionLabel(action: string): string {
  const [area, ...rest] = action.split('.')
  const name = rest.join('.').replaceAll('_', ' ')
  return name ? `${area.charAt(0).toUpperCase()}${area.slice(1)} · ${name}` : action
}
