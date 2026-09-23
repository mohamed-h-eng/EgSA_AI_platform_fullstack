/**
 * Thin fetch wrapper for the backend API.
 *
 * The auth feature plugs in via `configureHttp`:
 *   - getAccessToken:   the in-memory access token to send as a Bearer header
 *   - refreshSession:   obtains a new access token (returns false when the session is over)
 *   - onSessionExpired: called when a request is still 401 after trying to refresh
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown>

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface HttpHooks {
  getAccessToken: () => string | null
  refreshSession: () => Promise<boolean>
  onSessionExpired: () => void
}

const hooks: HttpHooks = {
  getAccessToken: () => null,
  refreshSession: async () => false,
  onSessionExpired: () => {},
}

export function configureHttp(overrides: Partial<HttpHooks>): void {
  Object.assign(hooks, overrides)
}

export interface HttpOptions extends Omit<RequestInit, 'body'> {
  /** Serialized as JSON with the matching Content-Type header. */
  json?: unknown
  body?: BodyInit
  /** Set false for endpoints that must not trigger the refresh-and-retry flow (e.g. /auth/*). */
  retryOnUnauthorized?: boolean
}

// Concurrent 401s share one refresh request.
let refreshInFlight: Promise<boolean> | null = null

function refreshOnce(): Promise<boolean> {
  refreshInFlight ??= hooks.refreshSession().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

async function send(
  path: string,
  options: Omit<HttpOptions, 'retryOnUnauthorized'>,
): Promise<Response> {
  const { json, headers: initHeaders, ...init } = options
  const headers = new Headers(initHeaders)
  headers.set('Accept', 'application/json')

  let body = init.body
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(json)
  }

  const token = hooks.getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  try {
    return await fetch(`${BASE_URL}${path}`, { ...init, body, headers, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection.')
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string; details?: Record<string, unknown> }
  } | null
  const error = payload?.error
  return new ApiError(
    response.status,
    error?.code ?? 'HTTP_ERROR',
    error?.message ?? `Request failed with status ${response.status}`,
    error?.details ?? {},
  )
}

export async function http<T>(path: string, options: HttpOptions = {}): Promise<T> {
  const { retryOnUnauthorized = true, ...requestOptions } = options
  let response = await send(path, requestOptions)

  if (response.status === 401 && retryOnUnauthorized) {
    if (await refreshOnce()) {
      response = await send(path, requestOptions)
    }
    if (response.status === 401) {
      hooks.onSessionExpired()
    }
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json().catch(() => null)) as T
}
