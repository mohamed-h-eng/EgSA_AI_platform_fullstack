import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DashboardPage } from '../pages/DashboardPage'

vi.mock('@features/auth', () => ({
  useAuth: () => ({ user: { full_name: 'Mohamed Hany' } }),
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <DashboardPage />
    </QueryClientProvider>,
  )
}

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  )
}

describe('DashboardPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('greets the user and shows backend and database as connected when healthy', async () => {
    mockFetch(200, { status: 'ok', database: 'ok' })
    renderPage()
    expect(screen.getByRole('heading', { name: 'Welcome, Mohamed Hany' })).toBeInTheDocument()
    expect(await screen.findAllByText('Connected')).toHaveLength(2)
  })

  it('shows the database as unavailable when the backend reports 503', async () => {
    mockFetch(503, { status: 'degraded', database: 'error' })
    renderPage()
    expect(await screen.findByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })

  it('shows both as unavailable when the backend is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    )
    renderPage()
    expect(await screen.findAllByText('Unavailable')).toHaveLength(2)
  })
})
