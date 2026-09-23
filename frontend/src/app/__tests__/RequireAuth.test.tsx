import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthStatus, AuthUser } from '@features/auth'

import { RequireAuth } from '../guards/RequireAuth'

const authState: { status: AuthStatus; user: AuthUser | null } = { status: 'loading', user: null }

vi.mock('@features/auth', () => ({ useAuth: () => authState }))

const user = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'u1',
  email: 'u@egsa.local',
  full_name: 'User',
  job_title: null,
  roles: ['engineer'],
  permissions: [],
  must_change_password: false,
  ...overrides,
})

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <p>login page</p> },
      {
        element: <RequireAuth allowPendingPasswordChange />,
        children: [{ path: '/change-password', element: <p>change password page</p> }],
      },
      { path: '/', element: <RequireAuth />, children: [{ index: true, element: <p>app</p> }] },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

describe('RequireAuth', () => {
  beforeEach(() => {
    authState.status = 'loading'
    authState.user = null
  })

  it('shows a loader while the session is being restored', () => {
    renderAt('/')
    expect(screen.getByRole('status')).toHaveTextContent('Restoring your session')
  })

  it('redirects anonymous users to /login', () => {
    authState.status = 'anonymous'
    renderAt('/')
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('renders the app for an authenticated user', () => {
    authState.status = 'authenticated'
    authState.user = user()
    renderAt('/')
    expect(screen.getByText('app')).toBeInTheDocument()
  })

  it('forces users with a temporary password to /change-password', () => {
    authState.status = 'authenticated'
    authState.user = user({ must_change_password: true })
    renderAt('/')
    expect(screen.getByText('change password page')).toBeInTheDocument()
  })
})
