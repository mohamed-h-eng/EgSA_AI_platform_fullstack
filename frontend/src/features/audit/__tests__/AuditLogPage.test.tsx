import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { json, mockApi } from '../../../test/fetch-mock'
import type { AuditEntry } from '../model/types'
import { actionLabel } from '../model/types'
import { AuditLogPage } from '../pages/AuditLogPage'

const entry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
  id: 'e1',
  action: 'document.upload',
  actor: { id: 'u1', full_name: 'Mohamed Hany', email: 'mohamed@egsa.local' },
  target_type: 'document',
  target_id: '9f1c2b7a-0000-0000-0000-000000000000',
  meta: { code: 'EPS-SRS-001' },
  ip: '10.0.0.5',
  created_at: '2026-09-28T09:00:00Z',
  ...overrides,
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuditLogPage />
    </QueryClientProvider>,
  )
}

describe('Audit log', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('labels actions readably', () => {
    expect(actionLabel('auth.login_failed')).toBe('Auth · login failed')
    expect(actionLabel('odd')).toBe('odd')
  })

  it('lists events, expands details and sends filters to the API', async () => {
    const urls: string[] = []
    mockApi({
      'GET /admin/audit-logs/actions': () => json(200, ['auth.login', 'document.upload']),
      'GET /admin/audit-logs': (_init, url) => {
        urls.push(url)
        return json(200, {
          items: [entry(), entry({ id: 'e2', action: 'auth.login', actor: null, meta: {} })],
          total: 2,
          page: 1,
          page_size: 25,
        })
      },
    })
    renderPage()

    expect(await screen.findByText('Document · upload')).toBeInTheDocument()
    expect(screen.getByText('System / unknown')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.getByText(/"code": "EPS-SRS-001"/)).toBeInTheDocument()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Filter by user' }), 'sara')
    await waitFor(() => expect(urls.at(-1)).toContain('actor=sara'))

    const from = screen.getByLabelText('From')
    await userEvent.type(from, '2026-09-01')
    await waitFor(() => expect(urls.at(-1)).toContain('from='))
    expect(new Date(new URL(urls.at(-1)!, 'http://x').searchParams.get('from')!).getDate()).toBe(1)

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(urls.at(-1)).not.toContain('actor='))
  })

  it('shows an empty state', async () => {
    mockApi({
      'GET /admin/audit-logs/actions': () => json(200, []),
      'GET /admin/audit-logs': () => json(200, { items: [], total: 0, page: 1, page_size: 25 }),
    })
    renderPage()
    expect(await screen.findByText('No events recorded yet.')).toBeInTheDocument()
  })
})
