import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockApi } from '../../../test/fetch-mock'
import { ChatTitleMenu } from '../components/ChatTitleMenu'
import { RecentChats } from '../components/RecentChats'
import type { Conversation } from '../model/types'
import { ChatsPage } from '../pages/ChatsPage'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), apiError: vi.fn() }))
vi.mock('@features/notifications', () => ({ notify }))

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()

const conv = (id: string, title: string, at: string): Conversation => ({
  id,
  title,
  project: null,
  visibility: 'private',
  message_count: 2,
  last_message_at: at,
  created_at: at,
  updated_at: at,
})

const page = (items: Conversation[]) => ({ items, total: items.length, page: 1, page_size: 50 })

function renderAt(path: string, element: ReactNode) {
  const router = createMemoryRouter(
    [
      { path: '/chat', element: <p>new chat screen</p> },
      { path: '/chat/:conversationId', element },
      { path: '/chats', element },
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

describe('Recent chats in the sidebar', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('groups by date, highlights the open chat and links to all chats', async () => {
    mockApi({
      'GET /conversations': () =>
        json(
          200,
          page([
            conv('c1', 'Battery sizing', daysAgo(0)),
            conv('c2', 'ما هو اختبار التفريغ الحراري؟', daysAgo(3)),
            conv('c3', 'Old question', daysAgo(40)),
          ]),
        ),
    })
    renderAt('/chat/c1', <RecentChats />)

    const recents = await screen.findByRole('region', { name: 'Recent chats' })
    const groups = (await within(recents).findAllByRole('heading')).map((h) => h.textContent)
    expect(groups).toEqual(['Today', 'Previous 7 days', 'Older'])
    expect(within(recents).getByRole('link', { name: 'Battery sizing' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(recents).getByText('ما هو اختبار التفريغ الحراري؟')).toHaveAttribute(
      'dir',
      'auto',
    )
    expect(within(recents).getByRole('link', { name: /View all chats/ })).toHaveAttribute(
      'href',
      '/chats',
    )
  })

  it('deleting the open chat goes back to a new chat', async () => {
    let deleted = false
    mockApi({
      'GET /conversations': () =>
        json(200, page(deleted ? [] : [conv('c1', 'Battery sizing', daysAgo(0))])),
      'DELETE /conversations/c1': () => {
        deleted = true
        return new Response(null, { status: 204 })
      },
    })
    const router = renderAt('/chat/c1', <RecentChats />)

    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Battery sizing' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/chat'))
    expect(notify.success).toHaveBeenCalledWith('Conversation deleted')
  })

  it('shows an empty state', async () => {
    mockApi({ 'GET /conversations': () => json(200, page([])) })
    renderAt('/chats', <RecentChats />)
    expect(await screen.findByText('No chats yet.')).toBeInTheDocument()
  })
})

describe('Chats page', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('searches on the server and shows an empty result', async () => {
    const urls: string[] = []
    mockApi({
      'GET /conversations': (_init, url) => {
        urls.push(url)
        return json(
          200,
          url.includes('q=') ? page([]) : page([conv('c1', 'Battery sizing', daysAgo(0))]),
        )
      },
    })
    renderAt('/chats', <ChatsPage />)

    expect(await screen.findByRole('link', { name: /Battery sizing/ })).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search chats' }), 'thermal')
    expect(await screen.findByText('No chats match your search.')).toBeInTheDocument()
    expect(urls.at(-1)).toContain('q=thermal')
  })
})

describe('Chat title menu', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renames the conversation from the top bar', async () => {
    let body: unknown
    mockApi({
      'PATCH /conversations/c1': (init) => {
        body = JSON.parse(String(init?.body))
        return json(200, conv('c1', 'EPS undervoltage', daysAgo(0)))
      },
    })
    renderAt('/chat/c1', <ChatTitleMenu conversation={conv('c1', 'Battery sizing', daysAgo(0))} />)

    await userEvent.click(
      screen.getByRole('button', { name: /Battery sizing: conversation options/ }),
    )
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    const input = screen.getByRole('textbox', { name: 'Conversation title' })
    await userEvent.clear(input)
    await userEvent.type(input, 'EPS undervoltage{Enter}')
    await waitFor(() => expect(body).toEqual({ title: 'EPS undervoltage' }))
  })
})
