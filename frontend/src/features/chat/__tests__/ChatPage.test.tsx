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
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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

  it('user messages sit on the right with Copy, and only the latest can be edited', async () => {
    let edited: unknown
    const history = [
      message({ id: 'u1', position: 0, content: 'First question' }),
      message({
        id: 'a1',
        position: 1,
        role: 'assistant',
        content: 'First answer',
        model: 'llama:free',
        latency_ms: 2400,
      }),
      message({ id: 'u2', position: 2, content: 'Typo questoin' }),
      message({
        id: 'a2',
        position: 3,
        role: 'assistant',
        content: 'Second answer',
        model: 'x/unknown-model:free',
        latency_ms: 850,
      }),
    ]
    mockApi({
      'GET /ai/models': () => json(200, MODELS),
      'GET /conversations': () => json(200, listPage([conversation()])),
      'GET /conversations/c1': () => json(200, conversation()),
      'GET /conversations/c1/messages': () => json(200, history),
      'PUT /conversations/c1/messages/u2': (init) => {
        edited = JSON.parse(String(init?.body))
        return json(200, {
          conversation: conversation(),
          user_message: { ...history[2], content: 'Fixed question' },
          assistant_message: { ...history[3], content: 'Better answer' },
        })
      },
    })
    renderAt('/chat/c1')

    const mine = await screen.findAllByRole('article', { name: 'Your message' })
    expect(mine[0]).toHaveClass('items-end')
    expect(within(mine[0]).getByRole('button', { name: 'Copy' })).toBeInTheDocument()
    expect(within(mine[0]).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()

    // AI actions: copy, retry only on the newest answer, response time, and the model's name.
    const answers = screen.getAllByRole('article', { name: 'AI response' })
    expect(within(answers[0]).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(within(answers[0]).getByText('Model: Llama Free')).toBeInTheDocument()
    expect(within(answers[0]).getByText('2.4s')).toBeInTheDocument()
    expect(within(answers[1]).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(within(answers[1]).getByText('Model: unknown-model')).toBeInTheDocument()
    expect(within(answers[1]).getByText('0.9s')).toBeInTheDocument()

    await userEvent.click(within(mine[1]).getByRole('button', { name: 'Edit' }))
    const box = screen.getByRole('textbox', { name: 'Edit your message' })
    await userEvent.clear(box)
    await userEvent.type(box, 'Fixed question')
    await userEvent.click(screen.getByRole('button', { name: /Save & resend/ }))
    await waitFor(() => expect(edited).toEqual({ content: 'Fixed question', model: null }))
    expect(await screen.findByText('Better answer')).toBeInTheDocument()
    expect(screen.getByText('Fixed question')).toBeInTheDocument()
  })
})
