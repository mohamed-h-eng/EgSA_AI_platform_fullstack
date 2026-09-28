import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserMenu } from '../components/UserMenu'

const logout = vi.fn()
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      email: 'mohamed@egsa.local',
      full_name: 'Mohamed Hany',
      job_title: null,
      roles: ['engineer'],
      permissions: [],
      must_change_password: false,
    },
    logout,
  }),
}))

function renderMenu(compact = false) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <UserMenu compact={compact} /> },
      { path: '/settings', element: <p>settings page</p> },
      { path: '/login', element: <p>login page</p> },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('Account menu (sidebar footer)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    logout.mockResolvedValue(undefined)
  })

  it('shows who is signed in and links to profile settings', async () => {
    const router = renderMenu()
    const trigger = screen.getByRole('button', { name: 'Account menu for Mohamed Hany' })
    expect(trigger).toHaveTextContent('Engineer')
    await userEvent.click(trigger)
    expect(await screen.findByText('mohamed@egsa.local')).toBeInTheDocument()
    // The menu takes the account button's width, so it stays inside the sidebar.
    expect(screen.getByRole('menu')).toHaveClass('w-(--radix-dropdown-menu-trigger-width)')
    await userEvent.click(screen.getByRole('menuitem', { name: /Profile & settings/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'))
  })

  it('About repeats the external-AI data notice (D2)', async () => {
    renderMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Account menu for Mohamed Hany' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'About' }))
    const dialog = await screen.findByRole('dialog', { name: 'EgSA AI Engineering Platform' })
    expect(dialog).toHaveTextContent('sent to an external AI provider')
  })

  it('signs out', async () => {
    const router = renderMenu(true)
    const trigger = screen.getByRole('button', { name: 'Account menu for Mohamed Hany' })
    expect(trigger).not.toHaveTextContent('Engineer') // avatar only in the icon rail
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    expect(logout).toHaveBeenCalled()
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})
