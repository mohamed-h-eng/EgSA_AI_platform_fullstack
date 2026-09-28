import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockApi } from '../../../test/fetch-mock'
import { UploadSettingsForm } from '../components/UploadSettingsForm'
import type { UploadSettings } from '../model/types'
import { ProfilePage } from '../pages/ProfilePage'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), apiError: vi.fn() }))
vi.mock('@features/notifications', () => ({ notify }))

const updateProfile = vi.fn()
vi.mock('@features/auth', () => ({
  roleLabel: () => 'Engineer',
  useAuth: () => ({
    user: {
      id: 'u1',
      email: 'mohamed@egsa.local',
      full_name: 'Mohamed Hany',
      job_title: null,
      roles: ['engineer'],
      permissions: [],
      must_change_password: false,
    },
    updateProfile,
  }),
}))

const uploads = (overrides: Partial<UploadSettings> = {}): UploadSettings => ({
  max_upload_mb: 50,
  allowed_file_types: ['pdf', 'docx', 'txt'],
  env_max_upload_mb: 50,
  env_allowed_file_types: ['pdf', 'docx', 'txt'],
  overridden: false,
  updated_at: null,
  updated_by: null,
  ...overrides,
})

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Upload settings', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('validates, then saves the new limits', async () => {
    let body: unknown
    mockApi({
      'PUT /admin/settings': (init) => {
        body = JSON.parse(String(init?.body))
        return json(
          200,
          uploads({ max_upload_mb: 10, allowed_file_types: ['pdf'], overridden: true }),
        )
      },
    })
    renderWithClient(<UploadSettingsForm settings={uploads()} />)

    const size = screen.getByLabelText('Maximum file size (MB)')
    await userEvent.clear(size)
    await userEvent.type(size, '0')
    await userEvent.click(screen.getByRole('checkbox', { name: 'PDF' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Word (DOCX)' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Plain text (TXT)' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save upload settings' }))
    expect(screen.getByText('Enter a whole number from 1 to 500.')).toBeInTheDocument()
    expect(screen.getByText('Allow at least one file type.')).toBeInTheDocument()
    expect(body).toBeUndefined()

    await userEvent.clear(size)
    await userEvent.type(size, '10')
    await userEvent.click(screen.getByRole('checkbox', { name: 'PDF' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save upload settings' }))
    expect(body).toEqual({ max_upload_mb: 10, allowed_file_types: ['pdf'] })
    expect(notify.success).toHaveBeenCalledWith('Upload settings saved')
  })

  it('offers a reset only when the defaults are overridden', async () => {
    let body: unknown
    mockApi({
      'PUT /admin/settings': (init) => {
        body = JSON.parse(String(init?.body))
        return json(200, uploads())
      },
    })
    renderWithClient(
      <UploadSettingsForm
        settings={uploads({
          max_upload_mb: 5,
          allowed_file_types: ['pdf'],
          overridden: true,
          updated_at: '2026-09-28T09:00:00Z',
          updated_by: { id: 'a', full_name: 'Admin', email: 'a@egsa.local' },
        })}
      />,
    )
    expect(screen.getByText(/Last changed .* by Admin/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
    expect(body).toMatchObject({ reset: true })
    expect(screen.getByLabelText('Maximum file size (MB)')).toHaveValue(50)
  })
})

describe('Profile page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('edits name and job title; email is read-only', async () => {
    updateProfile.mockResolvedValue({ full_name: 'Mohamed H.', job_title: 'Data Scientist' })
    renderWithClient(<ProfilePage />)

    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
    const save = screen.getByRole('button', { name: 'Save profile' })
    expect(save).toBeDisabled()

    const name = screen.getByLabelText('Full name')
    await userEvent.clear(name)
    await userEvent.click(save)
    expect(screen.getByText('Name is required.')).toBeInTheDocument()

    await userEvent.type(name, 'Mohamed H.')
    await userEvent.type(screen.getByLabelText('Job title'), '  Data Scientist ')
    await userEvent.click(save)
    expect(updateProfile).toHaveBeenCalledWith({
      full_name: 'Mohamed H.',
      job_title: 'Data Scientist',
    })
    expect(notify.success).toHaveBeenCalledWith('Profile updated')
    expect(screen.getByRole('link', { name: /Change password/ })).toHaveAttribute(
      'href',
      '/change-password',
    )
  })
})
