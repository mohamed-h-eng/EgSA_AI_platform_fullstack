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
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')

  let body = init.body
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(json)
  }

  const token = hooks.getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  try {
    return await fetch(`${BASE_URL}${path}`, { ...init, body, headers, credentials: 'include' })
  } catch (error) {
    // A deliberate cancel (e.g. the chat Stop button) is not a network failure.
    if (error instanceof DOMException && error.name === 'AbortError') throw error
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

/** Run `attempt`; on 401 refresh the session once and retry. Shared by every transport. */
async function withAuthRetry<R extends { status: number }>(
  attempt: () => Promise<R>,
  retry: boolean,
): Promise<R> {
  let result = await attempt()
  if (result.status === 401 && retry) {
    if (await refreshOnce()) result = await attempt()
    if (result.status === 401) hooks.onSessionExpired()
  }
  return result
}

async function request(path: string, options: HttpOptions): Promise<Response> {
  const { retryOnUnauthorized = true, ...requestOptions } = options
  const response = await withAuthRetry(() => send(path, requestOptions), retryOnUnauthorized)
  if (!response.ok) throw await toApiError(response)
  return response
}

export async function http<T>(path: string, options: HttpOptions = {}): Promise<T> {
  const response = await request(path, options)
  if (response.status === 204) return undefined as T
  return (await response.json().catch(() => null)) as T
}

/**
 * Authenticated request whose body is consumed as a stream (e.g. Server-Sent Events).
 * 401 → refresh → retry happens before any bytes are read; non-2xx throws ApiError.
 */
export async function httpStream(path: string, options: HttpOptions = {}): Promise<Response> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'text/event-stream')
  return request(path, { ...options, headers })
}

/** Authenticated binary download (a plain <a href> can't send the bearer token). */
export async function httpBlob(path: string): Promise<{ blob: Blob; filename: string | null }> {
  const response = await request(path, {})
  return { blob: await response.blob(), filename: filenameFrom(response.headers) }
}

function filenameFrom(headers: Headers): string | null {
  const disposition = headers.get('Content-Disposition') ?? ''
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (encoded) return decodeURIComponent(encoded[1])
  return /filename="([^"]+)"/i.exec(disposition)?.[1] ?? null
}

export interface UploadOptions {
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/**
 * Multipart upload with progress (fetch can't report upload progress, so this uses XHR).
 * Same auth header, 401 refresh-and-retry and error mapping as `http`.
 */
export async function httpUpload<T>(
  path: string,
  form: FormData,
  { onProgress, signal }: UploadOptions = {},
): Promise<T> {
  const attempt = () =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${BASE_URL}${path}`)
      xhr.withCredentials = true
      xhr.setRequestHeader('Accept', 'application/json')
      const token = hooks.getAccessToken()
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(e.loaded / e.total)
      }
      xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText })
      xhr.onerror = () =>
        reject(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection.'))
      xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
      signal?.addEventListener('abort', () => xhr.abort(), { once: true })
      xhr.send(form)
    })

  const result = await withAuthRetry(attempt, true)
  const payload: unknown = result.body ? JSON.parse(result.body) : null
  if (result.status < 200 || result.status >= 300) {
    const error = (
      payload as {
        error?: { code?: string; message?: string; details?: Record<string, unknown> }
      } | null
    )?.error
    throw new ApiError(
      result.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Upload failed with status ${result.status}`,
      error?.details ?? {},
    )
  }
  return payload as T
}
