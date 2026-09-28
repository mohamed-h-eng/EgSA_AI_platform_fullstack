import { StatusBadge } from '@shared/ui/status-badge'

import { type DocumentStatus, STATUS_META } from '../model/types'

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const meta = STATUS_META[status]
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}
