import { createContext } from 'react'

import type { ChangePasswordValues, LoginValues } from '../model/schemas'
import type { AuthStatus, AuthUser } from '../model/types'

export interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  login: (values: LoginValues) => Promise<AuthUser>
  logout: () => Promise<void>
  changePassword: (
    values: Pick<ChangePasswordValues, 'current_password' | 'new_password'>,
  ) => Promise<void>
  /** Self-service profile edit (name, job title); updates `user` in place. */
  updateProfile: (values: ProfileValues) => Promise<AuthUser>
}

export interface ProfileValues {
  full_name: string
  job_title: string | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)
