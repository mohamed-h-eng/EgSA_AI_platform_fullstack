import { http } from '@shared/api/http'

import type { ChangePasswordValues, LoginValues } from '../model/schemas'
import type { AuthUser, TokenResponse } from '../model/types'

// Auth endpoints never trigger the generic "401 → refresh → retry" flow.
const noRetry = { retryOnUnauthorized: false } as const

export function login(values: LoginValues): Promise<TokenResponse> {
  return http<TokenResponse>('/auth/login', { method: 'POST', json: values, ...noRetry })
}

/**
 * Exchange the refresh cookie for a new access token. Serialized across browser tabs with the
 * Web Locks API so two tabs never rotate the same cookie at once.
 */
export function refresh(): Promise<TokenResponse> {
  const run = () => http<TokenResponse>('/auth/refresh', { method: 'POST', ...noRetry })
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request('egsa-auth-refresh', run)
  }
  return run()
}

export function logout(): Promise<void> {
  return http<void>('/auth/logout', { method: 'POST', ...noRetry })
}

export function me(): Promise<AuthUser> {
  return http<AuthUser>('/auth/me')
}

export function changePassword(
  values: Pick<ChangePasswordValues, 'current_password' | 'new_password'>,
): Promise<TokenResponse> {
  return http<TokenResponse>('/me/password', {
    method: 'POST',
    json: { current_password: values.current_password, new_password: values.new_password },
  })
}
