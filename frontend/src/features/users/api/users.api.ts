import { http } from '@shared/api/http'
import type { Page } from '@shared/types/api'

import type { CreateUserValues, EditUserValues } from '../model/schemas'
import type { CreatedUser, ManagedUser, RoleInfo, UserFilters } from '../model/types'

export const USERS_PAGE_SIZE = 20

export function listUsers(filters: UserFilters): Promise<Page<ManagedUser>> {
  const params = new URLSearchParams({
    page: String(filters.page),
    page_size: String(filters.pageSize ?? USERS_PAGE_SIZE),
  })
  if (filters.q.trim()) params.set('q', filters.q.trim())
  if (filters.role) params.set('role', filters.role)
  if (filters.status) params.set('status', filters.status)
  return http(`/users?${params}`)
}

export function getUser(id: string): Promise<ManagedUser> {
  return http(`/users/${id}`)
}

export function listRoles(): Promise<RoleInfo[]> {
  return http('/roles')
}

export function createUser(values: CreateUserValues): Promise<CreatedUser> {
  return http('/users', {
    method: 'POST',
    json: {
      full_name: values.full_name,
      email: values.email,
      job_title: values.job_title || null,
      role: values.role,
      temporary_password: values.temporary_password || null,
    },
  })
}

export function updateUser(id: string, values: EditUserValues): Promise<ManagedUser> {
  return http(`/users/${id}`, {
    method: 'PATCH',
    json: { ...values, job_title: values.job_title || null },
  })
}

export function setUserActive(id: string, active: boolean): Promise<ManagedUser> {
  return http(`/users/${id}/${active ? 'enable' : 'disable'}`, { method: 'POST' })
}

export function assignRole(id: string, role: string): Promise<ManagedUser> {
  return http(`/users/${id}/role`, { method: 'PUT', json: { role } })
}

export function resetPassword(id: string): Promise<{ temporary_password: string }> {
  return http(`/users/${id}/reset-password`, { method: 'POST', json: {} })
}
