/** Mirrors backend `schemas/ai.py`. The API key itself is never sent to the browser. */
export interface AIConfig {
  provider: string
  base_url: string
  api_key_set: boolean
  api_key_hint: string | null
  api_key_unreadable: boolean
  configured: boolean
  default_model: string | null
  allowed_models: string[]
  system_prompt: string
  temperature: number
  max_tokens: number
  history_messages: number
  updated_at: string | null
  updated_by: { id: string; full_name: string; email: string } | null
}

export interface AIConfigUpdate {
  base_url?: string
  api_key?: string
  clear_api_key?: boolean
  default_model?: string | null
  allowed_models?: string[]
  system_prompt?: string
  temperature?: number
  max_tokens?: number
  history_messages?: number
}

export interface ConnectionTestResult {
  ok: boolean
  message: string
  model_count: number
  free_model_count: number
}

export interface AIModel {
  id: string
  name: string
  context_length: number | null
  is_free: boolean
}

export const OPENROUTER_DEFAULT_URL = 'https://openrouter.ai/api/v1'

/** Mirrors backend `schemas/admin.py::UploadSettingsOut` (phase 09). */
export type UploadFileType = 'pdf' | 'docx' | 'txt'
export const UPLOAD_FILE_TYPES: UploadFileType[] = ['pdf', 'docx', 'txt']
export const MAX_UPLOAD_MB_LIMIT = 500

export interface UploadSettings {
  max_upload_mb: number
  allowed_file_types: UploadFileType[]
  env_max_upload_mb: number
  env_allowed_file_types: UploadFileType[]
  overridden: boolean
  updated_at: string | null
  updated_by: { id: string; full_name: string; email: string } | null
}

export interface UploadSettingsUpdate {
  max_upload_mb: number
  allowed_file_types: UploadFileType[]
  reset?: boolean
}
