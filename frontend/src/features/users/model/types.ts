import type { StatusTone } from '@shared/ui/status-badge'

/** Mirrors backend `schemas/users.py`. */
export interface RoleRef {
  code: string
  name: string
}

export interface RoleInfo extends RoleRef {
  description: string | null
  permissions: string[]
}

export interface ManagedUser {
  id: string
  email: string
  full_name: string
  job_title: string | null
  is_active: boolean
  must_change_password: boolean
  roles: RoleRef[]
  last_login_at: string | null
  created_at: string
}

export type UserStatus = 'active' | 'pending' | 'disabled'

export interface UserFilters {
  q: string
  role: string
  status: UserStatus | ''
  page: number
  /** Rows per page; defaults to USERS_PAGE_SIZE. */
  pageSize?: number
}

export interface CreatedUser {
  user: ManagedUser
  temporary_password: string
}

export function userStatus(
  user: Pick<ManagedUser, 'is_active' | 'must_change_password'>,
): UserStatus {
  if (!user.is_active) return 'disabled'
  return user.must_change_password ? 'pending' : 'active'
}

export const STATUS_META: Record<UserStatus, { label: string; tone: StatusTone; hint: string }> = {
  active: { label: 'Active', tone: 'success', hint: 'Can sign in and use the platform.' },
  pending: {
    label: 'Pending password',
    tone: 'warning',
    hint: 'Has a temporary password and must set a new one at next sign-in.',
  },
  disabled: { label: 'Disabled', tone: 'danger', hint: 'Cannot sign in.' },
}

export function primaryRole(user: Pick<ManagedUser, 'roles'>): RoleRef | undefined {
  return user.roles[0]
}
