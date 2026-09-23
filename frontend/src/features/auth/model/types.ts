import type { PermissionCode } from '@shared/types/feature'

/** Mirrors backend `schemas/auth.py::CurrentUser`. */
export interface AuthUser {
  id: string
  email: string
  full_name: string
  job_title: string | null
  roles: string[]
  permissions: PermissionCode[]
  must_change_password: boolean
}

/** Mirrors backend `schemas/auth.py::TokenResponse`. */
export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  user: AuthUser
}

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  project_lead: 'Project Lead',
  engineer: 'Engineer',
  viewer: 'Viewer',
}

export function roleLabel(user: Pick<AuthUser, 'roles'>): string {
  return user.roles.map((r) => ROLE_LABELS[r] ?? r).join(', ') || 'No role'
}
