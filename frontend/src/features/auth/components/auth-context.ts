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
}

export const AuthContext = createContext<AuthContextValue | null>(null)
