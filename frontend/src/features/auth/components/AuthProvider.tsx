import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { configureHttp } from '@shared/api/http'

import * as authApi from '../api/auth.api'
import { session } from '../model/session'
import type { AuthStatus, AuthUser, TokenResponse } from '../model/types'
import { AuthContext, type AuthContextValue } from './auth-context'

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null })
  const bootstrapped = useRef(false)

  const applySession = useCallback((res: TokenResponse) => {
    session.setAccessToken(res.access_token)
    setState({ status: 'authenticated', user: res.user })
  }, [])

  const clearSession = useCallback(() => {
    session.setAccessToken(null)
    queryClient.clear() // never show one user's cached data to the next
    setState({ status: 'anonymous', user: null })
  }, [queryClient])

  useEffect(() => {
    configureHttp({
      getAccessToken: session.getAccessToken,
      refreshSession: async () => {
        try {
          applySession(await authApi.refresh())
          return true
        } catch {
          return false
        }
      },
      onSessionExpired: clearSession,
    })
  }, [applySession, clearSession])

  // Restore the session from the refresh cookie on page load. Runs once per provider
  // (StrictMode re-runs effects, and two parallel refreshes would race on the cookie).
  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true
    authApi
      .refresh()
      .then(applySession)
      .catch(() => setState({ status: 'anonymous', user: null }))
  }, [applySession])

  const login = useCallback<AuthContextValue['login']>(
    async (values) => {
      const res = await authApi.login(values)
      applySession(res)
      return res.user
    },
    [applySession],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      clearSession()
    }
  }, [clearSession])

  const changePassword = useCallback<AuthContextValue['changePassword']>(
    async (values) => {
      applySession(await authApi.changePassword(values))
    },
    [applySession],
  )

  const updateProfile = useCallback<AuthContextValue['updateProfile']>(async (values) => {
    const user = await authApi.updateProfile(values)
    setState((s) => ({ ...s, user }))
    return user
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, changePassword, updateProfile }),
    [state, login, logout, changePassword, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
