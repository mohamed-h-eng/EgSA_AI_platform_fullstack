import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthenticatedShell } from '../AuthenticatedShell'
import { withPermissionGuard } from '../router'

let permissions: string[] = []

vi.mock('@features/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@features/auth')>()),
  usePermission: (code?: string) => !code || permissions.includes(code),
  usePermissionChecker: () => (code?: string) => !code || permissions.includes(code),
  UserMenu: () => null,
}))

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AuthenticatedShell />,
        children: [
          { index: true, element: <p>home</p> },
          withPermissionGuard({
            path: 'admin/users',
            handle: { permission: 'users:create' },
            element: <p>user admin</p>,
          }),
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

describe('permission-aware UI', () => {
  beforeEach(() => {
    permissions = []
  })

  it('hides admin navigation from an engineer', () => {
    permissions = ['users:read', 'documents:read']
    renderAt('/')
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Users & Access' })).not.toBeInTheDocument()
    expect(screen.queryByText('Administration')).not.toBeInTheDocument()
  })

  it('shows admin navigation to an admin', () => {
    permissions = ['users:read', 'users:create']
    renderAt('/')
    expect(screen.getByRole('link', { name: 'Users & Access' })).toBeInTheDocument()
    expect(screen.getByText('Administration')).toBeInTheDocument()
  })

  it('blocks a guarded route when typed directly into the URL', () => {
    permissions = ['users:read']
    renderAt('/admin/users')
    expect(screen.getByRole('heading', { name: 'Not authorized' })).toBeInTheDocument()
    expect(screen.queryByText('user admin')).not.toBeInTheDocument()
  })

  it('renders a guarded route for a user with the permission', () => {
    permissions = ['users:create']
    renderAt('/admin/users')
    expect(screen.getByText('user admin')).toBeInTheDocument()
  })
})
