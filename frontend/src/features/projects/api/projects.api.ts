import { http } from '@shared/api/http'
import type { Page } from '@shared/types/api'

import type { ProjectValues } from '../model/schemas'
import type {
  Member,
  Project,
  ProjectDetail,
  ProjectFilters,
  ProjectRole,
  UserMembership,
  UserSummary,
} from '../model/types'

export const PROJECTS_PAGE_SIZE = 24

export function listProjects(
  filters: ProjectFilters,
  pageSize = PROJECTS_PAGE_SIZE,
): Promise<Page<Project>> {
  const params = new URLSearchParams({ page: String(filters.page), page_size: String(pageSize) })
  if (filters.q.trim()) params.set('q', filters.q.trim())
  if (filters.status) params.set('status', filters.status)
  return http(`/projects?${params}`)
}

export function getProject(id: string): Promise<ProjectDetail> {
  return http(`/projects/${id}`)
}

const toBody = (values: ProjectValues) => ({
  name: values.name,
  subsystem: values.subsystem || null,
  description: values.description || null,
  status: values.status,
})

export function createProject(values: ProjectValues): Promise<ProjectDetail> {
  return http('/projects', { method: 'POST', json: { code: values.code, ...toBody(values) } })
}

export function updateProject(id: string, values: ProjectValues): Promise<ProjectDetail> {
  return http(`/projects/${id}`, { method: 'PATCH', json: toBody(values) })
}

export function deleteProject(id: string): Promise<void> {
  return http(`/projects/${id}`, { method: 'DELETE' })
}

export function listMembers(projectId: string): Promise<Member[]> {
  return http(`/projects/${projectId}/members`)
}

export function addMember(projectId: string, userId: string, role: ProjectRole): Promise<Member> {
  return http(`/projects/${projectId}/members`, {
    method: 'POST',
    json: { user_id: userId, project_role: role },
  })
}

export function updateMember(
  projectId: string,
  userId: string,
  role: ProjectRole,
): Promise<Member> {
  return http(`/projects/${projectId}/members/${userId}`, {
    method: 'PATCH',
    json: { project_role: role },
  })
}

export function removeMember(projectId: string, userId: string): Promise<void> {
  return http(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' })
}

export function listUserMemberships(userId: string): Promise<UserMembership[]> {
  return http(`/users/${userId}/projects`)
}

/** Candidate members for the add-member picker (active users only; needs users:read). */
export async function searchUsers(q: string): Promise<UserSummary[]> {
  const params = new URLSearchParams({ q, status: 'active', page_size: '10' })
  const page = await http<Page<UserSummary>>(`/users?${params}`)
  return page.items
}
