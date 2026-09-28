import type { StatusTone } from '@shared/ui/status-badge'

/** Mirrors backend `schemas/projects.py`. */
export type ProjectStatus = 'planning' | 'in_development' | 'testing' | 'operational' | 'archived'
export type ProjectRole = 'lead' | 'engineer' | 'viewer'

export interface UserSummary {
  id: string
  full_name: string
  email: string
}

export interface Project {
  id: string
  code: string
  name: string
  description: string | null
  subsystem: string | null
  status: ProjectStatus
  member_count: number
  document_count: number
  my_role: ProjectRole | null
  created_by: UserSummary | null
  created_at: string
  updated_at: string
}

export interface ProjectAbilities {
  can_edit: boolean
  can_manage_members: boolean
  can_delete: boolean
}

export interface ProjectDetail extends Project {
  abilities: ProjectAbilities
}

export interface Member {
  user: UserSummary
  user_is_active: boolean
  project_role: ProjectRole
  added_at: string
}

export interface UserMembership {
  project_id: string
  code: string
  name: string
  status: ProjectStatus
  project_role: ProjectRole
}

export interface ProjectFilters {
  q: string
  status: ProjectStatus | ''
  page: number
}

export const STATUS_META: Record<ProjectStatus, { label: string; tone: StatusTone }> = {
  planning: { label: 'Planning', tone: 'neutral' },
  in_development: { label: 'In Development', tone: 'info' },
  testing: { label: 'Testing', tone: 'warning' },
  operational: { label: 'Operational', tone: 'success' },
  archived: { label: 'Archived', tone: 'neutral' },
}

export const PROJECT_STATUSES = Object.keys(STATUS_META) as ProjectStatus[]

export const ROLE_META: Record<ProjectRole, { label: string; hint: string }> = {
  lead: { label: 'Lead', hint: 'Manages the project and its members' },
  engineer: { label: 'Engineer', hint: 'Works on project documents' },
  viewer: { label: 'Viewer', hint: 'Read-only access' },
}

export const PROJECT_ROLES = Object.keys(ROLE_META) as ProjectRole[]
