import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockApi } from '../../../test/fetch-mock'
import type { ChatMessage, ChatModels, Conversation } from '../model/types'
import { ChatPage } from '../pages/ChatPage'

let permissions: string[] = []
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), apiError: vi.fn() }))

vi.mock('@features/auth', () => ({
  Can: ({
    permission,
    children,
    fallback = null,
  }: {
    permission: string
    children: ReactNode
    fallback?: ReactNode
  }) => (permissions.includes(permission) ? children : fallback),
  useAuth: () => ({ user: { full_name: 'Sara Engineer' } }),
}))
vi.mock('@features/projects', () => ({ ProjectSelect: () => <div>project select</div> }))
vi.mock('@features/notifications', () => ({ notify }))

const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'c1',
  title: 'Battery sizing',
  project: null,
  visibility: 'private',
  message_count: 2,
  last_message_at: new Date().toISOString(),
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
  ...overrides,
})

const message = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: 'm',
  position: 0,
  role: 'user',
  content: '',
  model: null,
  status: 'complete',
  error_code: null,
  prompt_tokens: null,
  completion_tokens: null,
  latency_ms: null,
  created_at: '2026-09-01T10:00:00Z',
  ...overrides,
})

const MODELS: ChatModels = {
  configured: true,
  default_model: 'llama:free',
  models: [{ id: 'llama:free', name: 'Llama Free' }],
}

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

/** An SSE response whose body is fed by the test; aborting the request errors the stream. */
function controllableStream(signal: AbortSignal | null | undefined) {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  signal?.addEventListener('abort', () =>
    controller.error(new DOMException('The operation was aborted.', 'AbortError')),
  )
  const encoder = new TextEncoder()
  return {
    response: new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }),
    push: (event: string, data: unknown) => controller.enqueue(encoder.encode(sse(event, data))),
    close: () => controller.close(),
  }
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/chat', element: <ChatPage /> },
      { path: '/chat/:conversationId', element: <ChatPage /> },
      { path: '/admin/settings', element: <p>settings page</p> },
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

const listPage = (items: Conversation[]) => ({ items, total: items.length, page: 1, page_size: 50 })

describe('Chat page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions = []
  })
  afterEach(() => vi.unstubAllGlobals())

  it('streams a reply into the conversation and keeps the data warning visible', async () => {
    const userMsg = message({ id: 'u1', position: 0, content: 'ما هو جهد البطارية؟' })
    const assistant = message({
      id: 'a1',
      position: 1,
      role: 'assistant',
      status: 'streaming',
      model: 'llama:free',
    })
    let stream!: ReturnType<typeof controllableStream>
    let sentBody: unknown
    mockApi({
      'GET /ai/models': () => json(200, MODELS),
      'GET /conversations': () => json(200, listPage([conversation()])),
      'GET /conversations/c1': () => json(200, conversation()),
      'GET /conversations/c1/messages': () => json(200, []),
      'POST /conversations/c1/messages/stream': (init) => {
        sentBody = JSON.parse(String(init?.body))
        stream = controllableStream(init?.signal)
        return stream.response
      },
    })
    renderAt('/chat/c1')

    expect(await screen.findByRole('heading', { name: 'Battery sizing' })).toBeInTheDocument()
    expect(screen.getByText(/Do not enter classified/i)).toBeInTheDocument()

    const box = screen.getByRole('textbox', { name: 'Message' })
    await userEvent.type(box, 'ما هو جهد البطارية؟{Enter}')
    expect(sentBody).toEqual({ content: 'ما هو جهد البطارية؟', model: null })

    stream.push('start', {
      conversation: conversation(),
      user_message: userMsg,
      assistant_message: assistant,
    })
    stream.push('delta', { text: 'The bus is ' })
    stream.push('delta', { text: '28 V.' })

    const log = screen.getByRole('log', { name: 'Messages' })
    expect(await within(log).findByText('The bus is 28 V.')).toBeInTheDocument()
    // Arabic text renders with automatic direction.
    expect(within(log).getByText('ما هو جهد البطارية؟')).toHaveAttribute('dir', 'auto')
    expect(screen.getByRole('button', { name: 'Stop generating' })).toBeInTheDocument()

    stream.push('done', {
      assistant_message: { ...assistant, status: 'complete', content: 'The bus is 28 V.' },
    })
    stream.close()
    expect(await screen.findByRole('button', { name: 'Send message' })).toBeInTheDocument()
    expect(screen.getByText(/Do not enter classified/i)).toBeInTheDocument()
  })

  it('Stop aborts the stream and marks the answer as stopped', async () => {
    let signal: AbortSignal | null | undefined
    let stream!: ReturnType<typeof controllableStream>
    const assistant = message({ id: 'a1', position: 1, role: 'assistant', status: 'streaming' })
    let saved: ChatMessage[] = []
    mockApi({
      'GET /ai/models': () => json(200, MODELS),
      'GET /conversations': () => json(200, listPage([conversation()])),
      'GET /conversations/c1': () => json(200, conversation()),
      'GET /conversations/c1/messages': () => json(200, saved),
      'POST /conversations/c1/messages/stream': (init) => {
        signal = init?.signal
        stream = controllableStream(init?.signal)
        return stream.response
      },
    })
    renderAt('/chat/c1')

    await userEvent.type(await screen.findByRole('textbox', { name: 'Message' }), 'Hi{Enter}')
    stream.push('start', {
      conversation: conversation(),
      user_message: message({ id: 'u1', content: 'Hi' }),
      assistant_message: assistant,
    })
    stream.push('delta', { text: 'Partial' })
    await screen.findByText('Partial')

    // After the abort the page re-syncs with the server's saved copy of the partial answer.
    saved = [
      message({ id: 'u1', content: 'Hi' }),
      { ...assistant, status: 'error', error_code: 'STREAM_ABORTED', content: 'Partial' },
    ]
    await userEvent.click(screen.getByRole('button', { name: 'Stop generating' }))
    expect(signal?.aborted).toBe(true)
    expect(await screen.findByText('Stopped.')).toBeInTheDocument()
    expect(screen.getByText('Partial')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument()
  })

  it('shows a failed reply with Retry, and Retry replaces it', async () => {
    const failed = message({
      id: 'a1',
      position: 1,
      role: 'assistant',
      status: 'error',
      error_code: 'AI_PROVIDER_ERROR',
      content: '',
    })
    let retried: unknown
    mockApi({
      'GET /ai/models': () => json(200, MODELS),
      'GET /conversations': () => json(200, listPage([conversation()])),
      'GET /conversations/c1': () => json(200, conversation()),
      'GET /conversations/c1/messages': () =>
        json(200, [message({ id: 'u1', content: 'Explain SAR' }), failed]),
      'POST /conversations/c1/retry': (init) => {
        retried = JSON.parse(String(init?.body))
        return json(200, {
          conversation: conversation(),
          user_message: null,
          assistant_message: {
            ...failed,
            status: 'complete',
            error_code: null,
            content: 'SAR is radar.',
          },
        })
      },
    })
    renderAt('/chat/c1')

    await userEvent.click(await screen.findByRole('button', { name: /retry/i }))
    expect(retried).toEqual({ model: null })
    expect(await screen.findByText('SAR is radar.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })

  it('disables the composer when AI is not configured and links admins to settings', async () => {
    permissions = ['settings:manage']
    mockApi({
      'GET /ai/models': () => json(200, { configured: false, default_model: null, models: [] }),
      'GET /conversations': () => json(200, listPage([])),
    })
    renderAt('/chat')

    expect(await screen.findByText(/hasn't been set up yet/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
    expect(screen.getByText('No conversations yet.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /Admin Settings/ }))
    expect(await screen.findByText('settings page')).toBeInTheDocument()
  })

  it('tells non-admins to ask an administrator', async () => {
    mockApi({
      'GET /ai/models': () => json(200, { configured: false, default_model: null, models: [] }),
      'GET /conversations': () => json(200, listPage([])),
    })
    renderAt('/chat')
    expect(await screen.findByText(/Ask an administrator/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Admin Settings/ })).not.toBeInTheDocument()
  })

  it('the first message of a new chat creates the conversation and opens it', async () => {
    let created: unknown
    const fresh = conversation({ id: 'c9', title: 'New chat', message_count: 0 })
    let stream!: ReturnType<typeof controllableStream>
    mockApi({
      'GET /ai/models': () => json(200, MODELS),
      'GET /conversations': () => json(200, listPage([])),
      'POST /conversations': (init) => {
        created = JSON.parse(String(init?.body))
        return json(201, fresh)
      },
      'GET /conversations/c9': () => json(200, fresh),
      'GET /conversations/c9/messages': () => json(200, []),
      'POST /conversations/c9/messages/stream': (init) => {
        stream = controllableStream(init?.signal)
        return stream.response
      },
    })
    const router = renderAt('/chat')

    await userEvent.type(await screen.findByRole('textbox', { name: 'Message' }), 'Hello{Enter}')
    expect(created).toEqual({ project_id: null })
    await waitFor(() => expect(router.state.location.pathname).toBe('/chat/c9'))
    await waitFor(() => expect(stream).toBeDefined())
    stream.push('start', {
      conversation: fresh,
      user_message: message({ id: 'u1', content: 'Hello' }),
      assistant_message: message({ id: 'a1', position: 1, role: 'assistant', status: 'streaming' }),
    })
    stream.push('delta', { text: 'Hi there' })
    expect(await screen.findByText('Hi there')).toBeInTheDocument()
    stream.close()
  })
})
