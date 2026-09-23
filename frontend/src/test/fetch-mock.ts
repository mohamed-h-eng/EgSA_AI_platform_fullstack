import { vi } from 'vitest'

type Handler = (init: RequestInit | undefined, url: string) => Response | Promise<Response>

export const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/**
 * Route-based fetch mock: `mockApi({ 'POST /auth/login': () => json(200, {...}) })`.
 * Keys are "METHOD /path" relative to /api/v1. Unmatched requests fail the test loudly.
 */
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const path = url.replace(/^.*\/api\/v1/, '')
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${path}`
    const handler = routes[key]
    if (!handler) throw new Error(`Unmocked request: ${key}`)
    return handler(init, url)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
