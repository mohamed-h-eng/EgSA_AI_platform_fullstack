import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { json, mockApi } from '../../../test/fetch-mock'
import { AuthProvider } from '../components/AuthProvider'
import { Can } from '../components/Can'
import { useAuth } from '../hooks/useAuth'
import type { AuthUser } from '../model/types'
import { LoginPage } from '../pages/LoginPage'

const engineer: AuthUser = {
  id: 'u1',
  email: 'eng@egsa.local',
  full_name: 'Mohamed Hany',
  job_title: 'Data Scientist',
  roles: ['engineer'],
  permissions: ['documents:read', 'documents:upload', 'chat:use'],
  must_change_password: false,
}

const tokenResponse = (user: AuthUser) => ({
  access_token: 'token',
  token_type: 'bearer',
  expires_in: 900,
  user,
})

const expired = () =>
  json(401, { error: { code: 'REFRESH_TOKEN_INVALID', message: 'Session expired' } })

function Home() {
  const { user } = useAuth()
  return (
    <div>
      <p>Home of {user?.full_name}</p>
      <Can permission="documents:upload">
        <button>Upload</button>
      </Can>
      <Can permission="users:create" fallback={<span>no admin</span>}>
        <button>Create user</button>
      </Can>
    </div>
  )
}

function renderApp(initialPath = '/login') {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <Home /> },
    ],
    { initialEntries: [initialPath] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('login flow', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('validates required fields before calling the API', async () => {
    const fetchMock = mockApi({ 'POST /auth/refresh': expired })
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter your email.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1) // only the session-restore attempt
  })

  it('shows the server message for invalid credentials', async () => {
    mockApi({
      'POST /auth/refresh': expired,
      'POST /auth/login': () =>
        json(401, {
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
        }),
    })
    renderApp()
    await userEvent.type(await screen.findByLabelText('Email'), 'eng@egsa.local')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
  })

  it('signs in, lands on home and hides actions without permission', async () => {
    mockApi({
      'POST /auth/refresh': expired,
      'POST /auth/login': () => json(200, tokenResponse(engineer)),
    })
    renderApp()
    await userEvent.type(await screen.findByLabelText('Email'), 'eng@egsa.local')
    await userEvent.type(screen.getByLabelText('Password'), 'Correct-Horse-42')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Home of Mohamed Hany')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create user' })).not.toBeInTheDocument()
    expect(screen.getByText('no admin')).toBeInTheDocument()
  })

  it('restores the session from the refresh cookie on load', async () => {
    const fetchMock = mockApi({ 'POST /auth/refresh': () => json(200, tokenResponse(engineer)) })
    renderApp('/login')
    // Already signed in → /login redirects home.
    expect(await screen.findByText('Home of Mohamed Hany')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
