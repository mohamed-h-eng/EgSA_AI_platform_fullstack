import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockApi } from '../../../test/fetch-mock'
import type { AIConfig } from '../model/types'
import { AdminSettingsPage } from '../pages/AdminSettingsPage'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), apiError: vi.fn() }))
vi.mock('@features/notifications', () => ({ notify }))

const KEY = 'sk-or-v1-typed-secret-key-1234'

const config = (overrides: Partial<AIConfig> = {}): AIConfig => ({
  provider: 'openrouter',
  base_url: 'https://openrouter.ai/api/v1',
  api_key_set: false,
  api_key_hint: null,
  api_key_unreadable: false,
  configured: false,
  default_model: null,
  allowed_models: [],
  system_prompt: 'You are the EgSA AI Engineering Assistant.',
  temperature: 0.3,
  max_tokens: 1024,
  history_messages: 20,
  updated_at: null,
  updated_by: null,
  ...overrides,
})

const MODELS = [
  { id: 'meta-llama/llama-free:free', name: 'Llama Free', context_length: 8192, is_free: true },
  { id: 'mistral/mistral-free:free', name: 'Mistral Free', context_length: 32768, is_free: true },
]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AdminSettingsPage />
    </QueryClientProvider>,
  )
}

describe('Admin Settings → AI model', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('guides a first-time setup: no key, test the typed key, then save it', async () => {
    let saved: Record<string, unknown> | undefined
    let tested: Record<string, unknown> | undefined
    mockApi({
      'GET /admin/ai/config': () => json(200, config()),
      'POST /admin/ai/config/test': (init) => {
        tested = JSON.parse(String(init?.body))
        return json(200, {
          ok: true,
          message: 'Connected to OpenRouter: 312 models available (40 free).',
          model_count: 312,
          free_model_count: 40,
        })
      },
      'PUT /admin/ai/config': (init) => {
        saved = JSON.parse(String(init?.body))
        return json(
          200,
          config({ api_key_set: true, api_key_hint: '…1234', updated_at: '2026-09-23T12:00:00Z' }),
        )
      },
      'GET /admin/ai/models': () => json(200, MODELS),
    })
    renderPage()

    expect(await screen.findByText('Not configured')).toBeInTheDocument()
    expect(screen.getByText('No key')).toBeInTheDocument()
    expect(screen.getByText(/Save an API key first/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Test connection' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Enter API key'), KEY)
    await userEvent.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(await screen.findByText(/312 models available/)).toBeInTheDocument()
    expect(tested).toEqual({ base_url: 'https://openrouter.ai/api/v1', api_key: KEY })

    await userEvent.click(screen.getByRole('button', { name: 'Save AI settings' }))
    await waitFor(() => expect(saved).toEqual({ api_key: KEY })) // only what changed
    expect(notify.success).toHaveBeenCalledWith('AI settings saved')

    // After saving, the key is only shown as a hint, never in full.
    expect(await screen.findByText('Key set (…1234)')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(KEY)
    expect(screen.getByLabelText('Replace API key')).toHaveValue('')
  })

  it('picks allowed models and a default from the free catalog', async () => {
    let saved: Record<string, unknown> | undefined
    mockApi({
      'GET /admin/ai/config': () => json(200, config({ api_key_set: true, api_key_hint: '…abcd' })),
      'GET /admin/ai/models': () => json(200, MODELS),
      'PUT /admin/ai/config': (init) => {
        saved = JSON.parse(String(init?.body))
        return json(200, config({ api_key_set: true, configured: true, updated_at: 'x' }))
      },
    })
    renderPage()

    const models = await screen.findByRole('group', { name: 'Free models' })
    await userEvent.click(within(models).getByRole('checkbox', { name: /Mistral Free/ }))
    await userEvent.click(within(models).getByRole('checkbox', { name: /Llama Free/ }))
    // The first allowed model became the default; make Llama the default instead.
    await userEvent.click(within(models).getByLabelText('Use Llama Free as the default model'))
    await userEvent.click(screen.getByRole('button', { name: 'Save AI settings' }))

    await waitFor(() =>
      expect(saved).toEqual({
        allowed_models: ['mistral/mistral-free:free', 'meta-llama/llama-free:free'],
        default_model: 'meta-llama/llama-free:free',
      }),
    )
  })

  it('removes the key and validates behaviour settings', async () => {
    let saved: Record<string, unknown> | undefined
    mockApi({
      'GET /admin/ai/config': () => json(200, config({ api_key_set: true, api_key_hint: '…abcd' })),
      'GET /admin/ai/models': () => json(200, MODELS),
      'PUT /admin/ai/config': (init) => {
        saved = JSON.parse(String(init?.body))
        return json(200, config({ updated_at: 'y' }))
      },
    })
    renderPage()

    const temperature = await screen.findByLabelText('Temperature')
    await userEvent.clear(temperature)
    await userEvent.type(temperature, '5')
    await userEvent.click(screen.getByRole('button', { name: 'Save AI settings' }))
    expect(await screen.findByText('Between 0 and 2.')).toBeInTheDocument()
    expect(saved).toBeUndefined()

    await userEvent.clear(temperature)
    await userEvent.type(temperature, '0.3')
    await userEvent.click(screen.getByRole('button', { name: 'Remove key' }))
    expect(screen.getByText('Will be removed on save')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save AI settings' }))
    await waitFor(() => expect(saved).toEqual({ clear_api_key: true }))
  })

  it('asks the admin to re-enter an unreadable key', async () => {
    mockApi({
      'GET /admin/ai/config': () => json(200, config({ api_key_unreadable: true })),
    })
    renderPage()
    expect(await screen.findByText("Stored key can't be read. Enter it again")).toBeInTheDocument()
  })
})
