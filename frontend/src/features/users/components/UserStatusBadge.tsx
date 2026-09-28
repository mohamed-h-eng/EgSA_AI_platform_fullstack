import { StatusBadge } from '@shared/ui/status-badge'

import { type ManagedUser, STATUS_META, userStatus } from '../model/types'

export function UserStatusBadge({
  user,
}: {
  user: Pick<ManagedUser, 'is_active' | 'must_change_password'>
}) {
  const meta = STATUS_META[userStatus(user)]
  return (
    <StatusBadge tone={meta.tone}>
      <span title={meta.hint}>{meta.label}</span>
    </StatusBadge>
  )
}
