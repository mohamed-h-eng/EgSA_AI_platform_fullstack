import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthenticatedShell } from '../AuthenticatedShell'
import { NotFoundPage } from '../RouteError'
import { withPermissionGuard } from '../router'

let permissions: string[] = []

vi.mock('@features/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@features/auth')>()),
  usePermission: (code?: string) => !code || permissions.includes(code),
  usePermissionChecker: () => (code?: string) => !code || permissions.includes(code),
  UserMenu: () => null,
}))

function Location() {
  const { pathname, search } = useLocation()
  return <p>at {pathname + search}</p>
}

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
          { path: 'documents', element: <Location /> },
          { path: 'projects', element: <Location /> },
          { path: '*', element: <NotFoundPage /> },
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

  it('Ctrl+K opens the header search; Enter searches documents', async () => {
    permissions = ['documents:read', 'projects:read']
    renderAt('/')
    await userEvent.keyboard('{Control>}k{/Control}')
    await userEvent.type(
      await screen.findByRole('searchbox', { name: 'Search text' }),
      'EPS-SRS{Enter}',
    )
    expect(await screen.findByText('at /documents?q=EPS-SRS')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('header search can target projects, and only offers what the user may read', async () => {
    permissions = ['projects:read']
    renderAt('/')
    await userEvent.click(screen.getByRole('button', { name: /search documents, projects/i }))
    expect(screen.queryByRole('button', { name: 'Search documents' })).not.toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search text' }), 'NEXSAT')
    await userEvent.click(screen.getByRole('button', { name: 'Search projects' }))
    expect(await screen.findByText('at /projects?q=NEXSAT')).toBeInTheDocument()
  })

  it('shows "page not found" inside the shell for unknown URLs (backlog B1)', () => {
    permissions = ['documents:read']
    renderAt('/no/such/page')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Main navigation' }).length).toBeGreaterThan(0)
  })
})
