import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockApi } from '../../../test/fetch-mock'
import type { DashboardSummary } from '../model/types'
import { DashboardPage } from '../pages/DashboardPage'

let permissions: string[] = []

vi.mock('@features/auth', () => ({
  Can: ({ permission, children }: { permission: string; children: ReactNode }) =>
    permissions.includes(permission) ? children : null,
  useAuth: () => ({ user: { full_name: 'Mohamed Hany' } }),
}))
vi.mock('@features/projects', () => ({
  ProjectStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}))

const summary = (overrides: Partial<DashboardSummary> = {}): DashboardSummary => ({
  counts: { projects: 2, documents: 14, conversations: 3, ai_requests: 42 },
  recent_conversations: [
    {
      id: 'c1',
      title: 'ما هو اختبار التفريغ الحراري؟',
      project: { id: 'p1', code: 'NEXSAT-1', name: 'NEXSAT-1 EPS' },
      message_count: 2,
      last_message_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ],
  recent_documents: [
    {
      id: 'd1',
      code: 'EPS-SRS-001',
      title: 'EPS Requirements',
      file_type: 'pdf',
      project: { id: 'p1', code: 'NEXSAT-1', name: 'NEXSAT-1 EPS' },
      uploaded_by: null,
      updated_at: new Date().toISOString(),
    },
  ],
  my_projects: [
    {
      id: 'p1',
      code: 'NEXSAT-1',
      name: 'NEXSAT-1 EPS',
      description: null,
      subsystem: 'EPS',
      status: 'in_development',
      member_count: 4,
      document_count: 14,
      my_role: 'engineer',
      created_by: null,
      created_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:00:00Z',
    },
  ],
  admin: null,
  ...overrides,
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    permissions = ['chat:use', 'documents:read', 'projects:read']
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows the hero, personal stats and recent work with links', async () => {
    mockApi({ 'GET /dashboard/summary': () => json(200, summary()) })
    renderPage()

    expect(screen.getByRole('heading', { name: 'Welcome, Mohamed Hany' })).toBeInTheDocument()
    expect(screen.getByText('Turn engineering knowledge into real progress.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /New chat/ })).toHaveAttribute('href', '/chat')

    const documents = await screen.findByRole('link', { name: /Documents\s*14/ })
    expect(documents).toHaveAttribute('href', '/documents')
    expect(screen.getByText('42')).toBeInTheDocument()

    const conversation = screen.getByRole('link', { name: /اختبار التفريغ/ })
    expect(conversation).toHaveAttribute('href', '/chat/c1')
    expect(within(conversation).getByText(/اختبار/)).toHaveAttribute('dir', 'auto')
    expect(screen.getByRole('link', { name: /EPS Requirements/ })).toHaveAttribute(
      'href',
      '/documents/d1',
    )
    expect(screen.getByRole('link', { name: /NEXSAT-1 EPS/ })).toHaveAttribute(
      'href',
      '/projects/p1',
    )
    // Engineers never see the admin block.
    expect(screen.queryByRole('heading', { name: 'Administration' })).not.toBeInTheDocument()
  })

  it('shows friendly empty states', async () => {
    mockApi({
      'GET /dashboard/summary': () =>
        json(
          200,
          summary({
            counts: { projects: 0, documents: 0, conversations: 0, ai_requests: 0 },
            recent_conversations: [],
            recent_documents: [],
            my_projects: [],
          }),
        ),
    })
    renderPage()
    expect(await screen.findByText(/No conversations yet/)).toBeInTheDocument()
    expect(screen.getByText('No documents in your projects yet.')).toBeInTheDocument()
    expect(screen.getByText('You are not a member of any project yet.')).toBeInTheDocument()
  })

  it('shows admins platform totals and AI usage per user', async () => {
    permissions.push('settings:manage')
    mockApi({
      'GET /dashboard/summary': () =>
        json(
          200,
          summary({
            admin: {
              active_users: 7,
              total_users: 8,
              total_projects: 3,
              total_documents: 20,
              ai_requests_7d: 12,
              failed_ai_requests_7d: 2,
              tokens_7d: 45_000,
              ai_usage_7d: [
                {
                  user: { id: 'u1', full_name: 'Sara Mohamed', email: 'sara@egsa.local' },
                  requests: 9,
                  failed: 2,
                  tokens: 40_000,
                },
                { user: null, requests: 3, failed: 0, tokens: 5_000 },
              ],
            },
          }),
        ),
    })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Administration' })).toBeInTheDocument()
    expect(screen.getByText('7 / 8')).toBeInTheDocument()
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(within(rows[1]).getByText('Sara Mohamed')).toBeInTheDocument()
    expect(within(rows[1]).getByText('40,000')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Deleted user')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View audit log' })).toHaveAttribute(
      'href',
      '/admin/audit',
    )
  })
})
