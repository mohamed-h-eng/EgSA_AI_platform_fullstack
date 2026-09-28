import { http } from '@shared/api/http'

import type { AIConfig, AIConfigUpdate, AIModel, ConnectionTestResult } from '../model/types'

export function getAIConfig(): Promise<AIConfig> {
  return http('/admin/ai/config')
}

export function updateAIConfig(body: AIConfigUpdate): Promise<AIConfig> {
  return http('/admin/ai/config', { method: 'PUT', json: body })
}

export function testAIConnection(body: {
  base_url?: string
  api_key?: string
}): Promise<ConnectionTestResult> {
  return http('/admin/ai/config/test', { method: 'POST', json: body })
}

export function listAvailableModels(freeOnly = true): Promise<AIModel[]> {
  return http(`/admin/ai/models?free_only=${freeOnly}`)
}
