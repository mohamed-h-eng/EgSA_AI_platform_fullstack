import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockApi } from '../../../test/fetch-mock'
import { SlotsProvider } from '@shared/lib/SlotsProvider'

import type { Member, Project, ProjectDetail } from '../model/types'
import { ProjectDetailPage } from '../pages/ProjectDetailPage'
import { ProjectsPage } from '../pages/ProjectsPage'

let permissions: string[] = []
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), apiError: vi.fn() }))

vi.mock('@features/auth', () => ({
  Can: ({ permission, children }: { permission: string; children: ReactNode }) =>
    permissions.includes(permission) ? children : null,
}))
vi.mock('@features/notifications', () => ({ notify }))

const project = (overrides: Partial<ProjectDetail> = {}): ProjectDetail => ({
  id: 'p1',
  code: 'NEXSAT-1',
  name: 'NEXSAT-1 Electrical Power System',
  description: 'Solar arrays, battery and power distribution.',
  subsystem: 'EPS',
  status: 'in_development',
  member_count: 3,
  document_count: 5,
  my_role: 'engineer',
  created_by: { id: 'a', full_name: 'Ahmed', email: 'ahmed@egsa.local' },
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-02T10:00:00Z',
  abilities: { can_edit: false, can_manage_members: false, can_delete: false },
  ...overrides,
})

const member = (id: string, name: string, role: Member['project_role']): Member => ({
  user: { id, full_name: name, email: `${id}@egsa.local` },
  user_is_active: true,
  project_role: role,
  added_at: '2026-09-01T10:00:00Z',
})

const page = (items: Project[]) => ({ items, total: items.length, page: 1, page_size: 24 })

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/projects/:projectId', element: <ProjectDetailPage /> },
    ],
    { initialEntries: [path] },
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('projects', () => {
  beforeEach(() => {
    permissions = ['projects:read']
    vi.clearAllMocks()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('lists visible projects as cards with status and my role', async () => {
    mockApi({
      'GET /projects': () =>
        json(
          200,
          page([
            project(),
            project({
              id: 'p2',
              code: 'SAR',
              name: 'SAR Payload Study',
              status: 'planning',
              my_role: 'lead',
            }),
          ]),
        ),
    })
    renderAt('/projects')

    const card = (await screen.findByText('NEXSAT-1 Electrical Power System')).closest('a')!
    expect(card).toHaveAttribute('href', '/projects/p1')
    expect(within(card).getByText('In Development')).toBeInTheDocument()
    expect(within(card).getByText('You: Engineer')).toBeInTheDocument()
    expect(within(card).getByText('3 members')).toBeInTheDocument()
    expect(screen.getByText('Planning')).toBeInTheDocument()
    // No projects:create → no "New project" button.
    expect(screen.queryByRole('button', { name: 'New project' })).not.toBeInTheDocument()
  })

  it('explains how to get access when the user has no projects', async () => {
    mockApi({ 'GET /projects': () => json(200, page([])) })
    renderAt('/projects')
    expect(await screen.findByText('No projects yet')).toBeInTheDocument()
    expect(screen.getByText(/Ask a project lead or an administrator/)).toBeInTheDocument()
  })

  it('shows "New project" to users who can create projects', async () => {
    permissions = ['projects:read', 'projects:create']
    mockApi({ 'GET /projects': () => json(200, page([])) })
    renderAt('/projects')
    expect(await screen.findByRole('button', { name: 'New project' })).toBeInTheDocument()
  })

  it('hides edit, delete and member management from a plain member', async () => {
    mockApi({
      'GET /projects/p1': () => json(200, project()),
      'GET /projects/p1/members': () => json(200, [member('u1', 'Ahmed', 'lead')]),
    })
    renderAt('/projects/p1')

    expect(
      await screen.findByRole('heading', { name: 'NEXSAT-1 Electrical Power System' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: /Members/ }))
    expect(await screen.findByText('Ahmed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })

  it('lets a lead add a member through the search picker', async () => {
    let added: unknown
    mockApi({
      'GET /projects/p1': () =>
        json(
          200,
          project({
            my_role: 'lead',
            abilities: { can_edit: true, can_manage_members: true, can_delete: false },
          }),
        ),
      'GET /projects/p1/members': () => json(200, [member('u1', 'Ahmed', 'lead')]),
      'GET /users': (_init, url) =>
        json(200, {
          items: url.includes('q=sar')
            ? [
                { id: 'u1', full_name: 'Ahmed', email: 'u1@egsa.local' },
                { id: 'u2', full_name: 'Sara Mohamed', email: 'sara@egsa.local' },
              ]
            : [],
          total: 2,
          page: 1,
          page_size: 10,
        }),
      'POST /projects/p1/members': (init) => {
        added = JSON.parse(String(init?.body))
        return json(201, member('u2', 'Sara Mohamed', 'viewer'))
      },
    })
    renderAt('/projects/p1')

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: /Members/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Add member' }))

    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('User'), 'sar')
    // Existing members are filtered out of the candidates.
    const option = await within(dialog).findByRole('option', { name: /Sara Mohamed/ })
    expect(within(dialog).queryByRole('option', { name: /Ahmed/ })).not.toBeInTheDocument()
    await userEvent.click(option)

    await userEvent.click(within(dialog).getByLabelText('Project role'))
    await userEvent.click(await screen.findByRole('option', { name: /Viewer/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add member' }))

    await vi.waitFor(() => expect(added).toEqual({ user_id: 'u2', project_role: 'viewer' }))
    expect(notify.success).toHaveBeenCalledWith('Project access granted', 'Sara Mohamed → NEXSAT-1')
  })

  it('shows a not-found page for projects the user cannot see', async () => {
    mockApi({
      'GET /projects/secret': () =>
        json(404, { error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found.' } }),
    })
    renderAt('/projects/secret')
    expect(await screen.findByRole('heading', { name: 'Project not found' })).toBeInTheDocument()
    expect(screen.getByText("It doesn't exist or you're not a member of it.")).toBeInTheDocument()
  })

  it('renders tabs contributed by other features through slots', async () => {
    mockApi({ 'GET /projects/p1': () => json(200, project({ my_role: 'viewer' })) })
    const received: unknown[] = []
    const router = createMemoryRouter(
      [{ path: '/projects/:projectId', element: <ProjectDetailPage /> }],
      { initialEntries: ['/projects/p1'] },
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <SlotsProvider
          slots={{
            projectTabs: [
              {
                id: 'documents',
                label: 'Documents',
                order: 10,
                render: (ctx) => {
                  received.push(ctx)
                  return <p>contributed content</p>
                },
              },
            ],
          }}
        >
          <RouterProvider router={router} />
        </SlotsProvider>
      </QueryClientProvider>,
    )

    await userEvent.click(await screen.findByRole('tab', { name: 'Documents' }))
    expect(await screen.findByText('contributed content')).toBeInTheDocument()
    // A project Viewer can't contribute; the slot is told so.
    expect(received.at(-1)).toEqual({
      projectId: 'p1',
      projectCode: 'NEXSAT-1',
      canContribute: false,
    })
  })
})
