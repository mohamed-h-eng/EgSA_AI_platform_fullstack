import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockApi } from '../../../test/fetch-mock'
import type { DocumentItem } from '../model/types'
import { DocumentsPage } from '../pages/DocumentsPage'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), apiError: vi.fn() }))
vi.mock('@features/notifications', () => ({ notify }))
vi.mock('@features/auth', () => ({ Can: ({ children }: { children: ReactNode }) => children }))
vi.mock('@features/projects', () => ({
  ProjectSelect: ({
    value,
    'aria-label': label,
  }: {
    value: string | null
    'aria-label'?: string
  }) => <span aria-label={label ?? 'Project'}>{value ?? 'no project'}</span>,
}))

const doc = (overrides: Partial<DocumentItem> = {}): DocumentItem => ({
  id: 'd1',
  code: 'EPS-SRS-001',
  title: 'Electrical Power System Requirements',
  description: 'Battery undervoltage requirements',
  revision: 'C',
  status: 'approved',
  category: { code: 'requirements', name: 'Requirements' },
  project: { id: 'p1', code: 'NEXSAT-1', name: 'NEXSAT-1 EPS' },
  file_type: 'pdf',
  size_bytes: 2048,
  original_filename: 'EPS-SRS-001.pdf',
  uploaded_by: { id: 'u1', full_name: 'Mohamed Hany', email: 'm@egsa.local' },
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-21T10:00:00Z',
  abilities: { can_edit: true, can_delete: true },
  ...overrides,
})

const page = (items: DocumentItem[]) => ({ items, total: items.length, page: 1, page_size: 20 })

const baseRoutes = {
  'GET /documents/categories': () =>
    json(200, [
      { code: 'requirements', name: 'Requirements' },
      { code: 'test', name: 'Test' },
    ]),
  'GET /documents/upload-config': () =>
    json(200, { max_upload_bytes: 1024 * 1024, allowed_types: ['pdf', 'docx', 'txt'] }),
}

function renderPage(path = '/documents') {
  const router = createMemoryRouter(
    [
      { path: '/documents', element: <DocumentsPage /> },
      { path: '/documents/:documentId', element: <DocumentsPage /> },
    ],
    { initialEntries: [path] },
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

/** Minimal XMLHttpRequest stand-in for httpUpload (jsdom can't reach a server). */
class FakeXHR {
  static last: FakeXHR | null = null
  static delayMs = 10
  static respond: (xhr: FakeXHR) => { status: number; body: unknown } = () => ({
    status: 201,
    body: doc(),
  })
  upload = {
    onprogress: null as
      ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null,
  }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  status = 0
  responseText = ''
  withCredentials = false
  method = ''
  url = ''
  headers: Record<string, string> = {}
  body: FormData | null = null
  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }
  send(body: FormData) {
    this.body = body
    FakeXHR.last = this
    setTimeout(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 })
      const { status, body: payload } = FakeXHR.respond(this)
      this.status = status
      this.responseText = JSON.stringify(payload)
      this.onload?.()
    }, FakeXHR.delayMs)
  }
  abort() {
    this.onabort?.()
  }
}

describe('documents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    FakeXHR.last = null
    FakeXHR.delayMs = 10
    FakeXHR.respond = () => ({ status: 201, body: doc() })
    vi.stubGlobal('XMLHttpRequest', FakeXHR)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('lists documents with type, code, project and status, and filters by type', async () => {
    const fetchMock = mockApi({
      ...baseRoutes,
      'GET /documents': (_init, url) =>
        json(
          200,
          url.includes('type=docx')
            ? page([doc({ id: 'd2', code: 'EPS-DD-002', file_type: 'docx', status: 'draft' })])
            : page([
                doc(),
                doc({ id: 'd2', code: 'EPS-DD-002', file_type: 'docx', status: 'draft' }),
              ]),
        ),
    })
    renderPage()

    const row = (await screen.findByText('EPS-SRS-001')).closest('tr')!
    expect(within(row).getByRole('img', { name: 'PDF file' })).toBeInTheDocument()
    expect(within(row).getByText('Rev. C')).toBeInTheDocument()
    expect(within(row).getByText('NEXSAT-1')).toBeInTheDocument()
    expect(within(row).getByText('Approved')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('combobox', { name: 'Filter by file type' }))
    await userEvent.click(await screen.findByRole('option', { name: 'DOCX' }))
    await waitFor(() => expect(screen.queryByText('EPS-SRS-001')).not.toBeInTheDocument())
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('type=docx'))).toBe(true)
  })

  it('opens the drawer from the URL and hides actions the user lacks', async () => {
    mockApi({
      ...baseRoutes,
      'GET /documents': () => json(200, page([doc()])),
      'GET /documents/d1': () =>
        json(200, doc({ file_type: 'docx', abilities: { can_edit: false, can_delete: false } })),
    })
    renderPage('/documents/d1')

    const drawer = await screen.findByRole('dialog')
    expect(
      await within(drawer).findByText('Electrical Power System Requirements'),
    ).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Download' })).toBeInTheDocument()
    // DOCX can't be viewed in the browser; no edit/delete without abilities.
    expect(within(drawer).queryByRole('button', { name: 'View' })).not.toBeInTheDocument()
    expect(within(drawer).queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()
    expect(within(drawer).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
  })

  it('downloads through an authenticated request with the server filename', async () => {
    const createObjectURL = vi.fn(() => 'blob:doc')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    mockApi({
      ...baseRoutes,
      'GET /documents': () => json(200, page([doc()])),
      'GET /documents/d1': () => json(200, doc()),
      'GET /documents/d1/download': () =>
        new Response('%PDF-1.4', {
          status: 200,
          headers: {
            'Content-Disposition':
              'attachment; filename="x.pdf"; filename*=UTF-8\'\'%D8%AA%D9%82%D8%B1%D9%8A%D8%B1.pdf',
          },
        }),
    })
    renderPage('/documents/d1')

    await userEvent.click(await screen.findByRole('button', { name: 'Download' }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    const anchor = click.mock.contexts[0] as HTMLAnchorElement
    expect(anchor.download).toBe('تقرير.pdf')
    expect(createObjectURL).toHaveBeenCalled()
  })

  it('rejects an unsupported file before uploading', async () => {
    mockApi({ ...baseRoutes, 'GET /documents': () => json(200, page([])) })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Upload' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.upload(
      within(dialog).getByLabelText('File to upload'),
      new File(['MZ'], 'tool.exe', { type: 'application/octet-stream' }),
      { applyAccept: false },
    )
    expect(
      await within(dialog).findByText('Only PDF, DOCX, TXT files can be uploaded.'),
    ).toBeInTheDocument()

    await userEvent.upload(
      within(dialog).getByLabelText('File to upload'),
      new File([new Uint8Array(2 * 1024 * 1024)], 'huge.pdf', { type: 'application/pdf' }),
    )
    expect(await within(dialog).findByText(/limit is 1.0 MB/)).toBeInTheDocument()
    expect(FakeXHR.last).toBeNull()
  })

  it('uploads with metadata suggested from the filename and shows progress', async () => {
    mockApi({ ...baseRoutes, 'GET /documents': () => json(200, page([])) })
    const router = renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Upload' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.upload(
      within(dialog).getByLabelText('File to upload'),
      new File(['%PDF-1.4'], 'EPS-SRS-001 Battery requirements.pdf', { type: 'application/pdf' }),
    )
    expect(within(dialog).getByLabelText('Document code')).toHaveValue('EPS-SRS-001')
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Battery requirements')

    // Project is required.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Upload' }))
    expect(await within(dialog).findByText('Choose a project.')).toBeInTheDocument()
    expect(FakeXHR.last).toBeNull()
    expect(router.state.location.pathname).toBe('/documents')
  })

  it('maps a duplicate-code error from the server onto the code field', async () => {
    FakeXHR.respond = () => ({
      status: 409,
      body: {
        error: {
          code: 'DOCUMENT_CODE_EXISTS',
          message: 'A document with code EPS-SRS-001 already exists in NEXSAT-1.',
        },
      },
    })
    mockApi({ ...baseRoutes, 'GET /documents': () => json(200, page([])) })
    const { DocumentLibrary } = await import('../components/DocumentLibrary')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter([{ path: '/', element: <DocumentLibrary projectId="p1" /> }])
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Upload' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.upload(
      within(dialog).getByLabelText('File to upload'),
      new File(['%PDF-1.4'], 'EPS-SRS-001 Requirements.pdf', { type: 'application/pdf' }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Upload' }))

    expect(await within(dialog).findByText(/already exists in NEXSAT-1/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Document code')).toHaveAttribute('aria-invalid', 'true')
    const sent = FakeXHR.last!
    expect(sent.method).toBe('POST')
    expect(sent.url).toBe('/api/v1/documents')
    expect(sent.body!.get('project_id')).toBe('p1')
    expect(sent.body!.get('code')).toBe('EPS-SRS-001')
    expect((sent.body!.get('file') as File).name).toBe('EPS-SRS-001 Requirements.pdf')
  })

  it('uploads into the scoped project, reports progress and closes on success', async () => {
    FakeXHR.delayMs = 300 // long enough to observe the progress state
    mockApi({ ...baseRoutes, 'GET /documents': () => json(200, page([])) })
    const { DocumentLibrary } = await import('../components/DocumentLibrary')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter([{ path: '/', element: <DocumentLibrary projectId="p1" /> }])
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Upload' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.upload(
      within(dialog).getByLabelText('File to upload'),
      new File(['%PDF-1.4'], 'EPS-SRS-001 Requirements.pdf', { type: 'application/pdf' }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Upload' }))

    expect(await within(dialog).findByText(/Uploading/)).toBeInTheDocument()
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith(
        'Document uploaded successfully',
        'EPS-SRS-001 · NEXSAT-1',
      ),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
