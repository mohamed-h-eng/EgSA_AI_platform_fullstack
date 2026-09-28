import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { json, mockApi } from '../../../test/fetch-mock'
import type { ManagedUser } from '../model/types'
import { UsersPage } from '../pages/UsersPage'

vi.mock('@features/auth', () => ({
  Can: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ user: { id: 'me' } }),
}))
vi.mock('@features/notifications', () => ({
  notify: { success: vi.fn(), error: vi.fn(), apiError: vi.fn() },
}))

const user = (overrides: Partial<ManagedUser>): ManagedUser => ({
  id: 'u1',
  email: 'mohamed@egsa.local',
  full_name: 'Mohamed Hany',
  job_title: 'Data Scientist',
  is_active: true,
  must_change_password: false,
  roles: [{ code: 'engineer', name: 'Engineer' }],
  last_login_at: null,
  created_at: '2026-09-01T10:00:00Z',
  ...overrides,
})

const ROLES = [
  { code: 'admin', name: 'Admin', description: 'Full platform administration', permissions: [] },
  {
    code: 'engineer',
    name: 'Engineer',
    description: 'Works in assigned projects',
    permissions: [],
  },
]

const page = (items: ManagedUser[]) => ({ items, total: items.length, page: 1, page_size: 20 })

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <UsersPage />
    </QueryClientProvider>,
  )
}

describe('UsersPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists users with role and status', async () => {
    mockApi({
      'GET /roles': () => json(200, ROLES),
      'GET /users': () =>
        json(
          200,
          page([
            user({}),
            user({
              id: 'u2',
              full_name: 'Sara Mohamed',
              email: 'sara@egsa.local',
              is_active: false,
            }),
            user({
              id: 'u3',
              full_name: 'محمد هاني',
              email: 'ar@egsa.local',
              must_change_password: true,
            }),
          ]),
        ),
    })
    renderPage()

    const row = (await screen.findByText('Mohamed Hany')).closest('tr')!
    expect(within(row).getByText('Engineer')).toBeInTheDocument()
    expect(within(row).getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Disabled')).toBeInTheDocument()
    expect(screen.getByText('Pending password')).toBeInTheDocument()
    expect(screen.getByText('محمد هاني')).toHaveAttribute('dir', 'auto')
    expect(screen.getByText('Showing 1–3 of 3 users')).toBeInTheDocument()
  })

  it('sends the search term and shows the filtered empty state', async () => {
    const fetchMock = mockApi({
      'GET /roles': () => json(200, ROLES),
      'GET /users': (_init, url) =>
        json(200, url.includes('q=nobody') ? page([]) : page([user({})])),
    })
    renderPage()
    await screen.findByText('Mohamed Hany')

    await userEvent.type(screen.getByLabelText('Search users'), 'nobody')
    expect(await screen.findByText('No users match your filters')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('q=nobody'))).toBe(true)
  })

  it('creates a user and reveals the temporary password once', async () => {
    let createdBody: Record<string, unknown> | undefined
    mockApi({
      'GET /roles': () => json(200, ROLES),
      'GET /users': () => json(200, page([])),
      'POST /users': (init) => {
        createdBody = JSON.parse(String(init?.body))
        return json(201, {
          user: user({ id: 'new', full_name: 'Sara Mohamed', must_change_password: true }),
          temporary_password: 'Xk7m-Pq2r-Wz9t',
        })
      },
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Add user' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Full name'), 'Sara Mohamed')
    await userEvent.type(within(dialog).getByLabelText('Email'), 'sara@egsa.local')

    // Role is required.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add user' }))
    expect(await within(dialog).findByText('Choose a role.')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('combobox'))
    await userEvent.click(await screen.findByRole('option', { name: /Engineer/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add user' }))

    expect(await screen.findByLabelText('Temporary password')).toHaveTextContent('Xk7m-Pq2r-Wz9t')
    expect(screen.getByText('This password will not be shown again.')).toBeInTheDocument()
    expect(createdBody).toEqual({
      full_name: 'Sara Mohamed',
      email: 'sara@egsa.local',
      job_title: null,
      role: 'engineer',
      temporary_password: null,
    })
  })

  it('shows a duplicate email error on the email field', async () => {
    mockApi({
      'GET /roles': () => json(200, ROLES),
      'GET /users': () => json(200, page([])),
      'POST /users': () =>
        json(409, {
          error: { code: 'EMAIL_EXISTS', message: 'A user with this email already exists.' },
        }),
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Add user' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Full name'), 'Dup')
    await userEvent.type(within(dialog).getByLabelText('Email'), 'dup@egsa.local')
    await userEvent.click(within(dialog).getByRole('combobox'))
    await userEvent.click(await screen.findByRole('option', { name: /Engineer/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add user' }))

    expect(
      await within(dialog).findByText('A user with this email already exists.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })
})
