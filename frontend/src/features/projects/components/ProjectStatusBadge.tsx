import { StatusBadge } from '@shared/ui/status-badge'

import { type ProjectStatus, STATUS_META } from '../model/types'

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const meta = STATUS_META[status]
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}
