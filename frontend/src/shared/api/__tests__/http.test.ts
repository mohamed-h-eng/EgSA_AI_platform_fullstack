import { afterEach, describe, expect, it, vi } from 'vitest'

import { json, mockApi } from '../../../test/fetch-mock'
import { ApiError, configureHttp, http } from '../http'

describe('http', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    configureHttp({
      getAccessToken: () => null,
      refreshSession: async () => false,
      onSessionExpired: () => {},
    })
  })

  it('sends the bearer token and parses JSON', async () => {
    const fetchMock = mockApi({ 'GET /things': () => json(200, { ok: true }) })
    configureHttp({ getAccessToken: () => 'abc' })

    await expect(http('/things')).resolves.toEqual({ ok: true })
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer abc')
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe('include')
  })

  it('maps the standard error body to ApiError', async () => {
    mockApi({
      'GET /missing': () => json(404, { error: { code: 'NOT_FOUND', message: 'Nope' } }),
    })
    const error = await http('/missing').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Nope' })
  })

  it('refreshes once on 401 and retries with the new token', async () => {
    let token = 'old'
    mockApi({
      'GET /me': (init) =>
        (init?.headers as Headers).get('Authorization') === 'Bearer new'
          ? json(200, { id: 1 })
          : json(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } }),
    })
    const refreshSession = vi.fn(async () => {
      token = 'new'
      return true
    })
    configureHttp({ getAccessToken: () => token, refreshSession })

    await expect(http('/me')).resolves.toEqual({ id: 1 })
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('shares one refresh between concurrent 401s', async () => {
    let token = 'old'
    mockApi({
      'GET /a': (init) =>
        (init?.headers as Headers).get('Authorization') === 'Bearer new'
          ? json(200, 'a')
          : json(401, {}),
      'GET /b': (init) =>
        (init?.headers as Headers).get('Authorization') === 'Bearer new'
          ? json(200, 'b')
          : json(401, {}),
    })
    const refreshSession = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10))
      token = 'new'
      return true
    })
    configureHttp({ getAccessToken: () => token, refreshSession })

    await expect(Promise.all([http('/a'), http('/b')])).resolves.toEqual(['a', 'b'])
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('reports session expiry when the refresh fails', async () => {
    mockApi({ 'GET /me': () => json(401, { error: { code: 'TOKEN_EXPIRED', message: 'x' } }) })
    const onSessionExpired = vi.fn()
    configureHttp({ refreshSession: async () => false, onSessionExpired })

    await expect(http('/me')).rejects.toMatchObject({ status: 401 })
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('does not refresh when retryOnUnauthorized is false', async () => {
    mockApi({
      'POST /auth/login': () => json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'x' } }),
    })
    const refreshSession = vi.fn(async () => true)
    configureHttp({ refreshSession })

    await expect(
      http('/auth/login', { method: 'POST', retryOnUnauthorized: false }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
    expect(refreshSession).not.toHaveBeenCalled()
  })
})
