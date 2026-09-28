import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AIConfigUpdate } from '../model/types'
import * as api from './settings.api'

export const settingsKeys = {
  aiConfig: () => ['admin', 'ai-config'] as const,
  aiModels: (freeOnly: boolean) => ['admin', 'ai-models', freeOnly] as const,
}

export function useAIConfig() {
  return useQuery({ queryKey: settingsKeys.aiConfig(), queryFn: api.getAIConfig })
}

export function useAvailableModels(enabled: boolean, freeOnly = true) {
  return useQuery({
    queryKey: settingsKeys.aiModels(freeOnly),
    queryFn: () => api.listAvailableModels(freeOnly),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useUpdateAIConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: AIConfigUpdate) => api.updateAIConfig(body),
    onSuccess: (config) => {
      queryClient.setQueryData(settingsKeys.aiConfig(), config)
      // Key or URL changes can change the catalog; chat users' model list changes too.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ai-models'] })
      void queryClient.invalidateQueries({ queryKey: ['ai-models'] })
    },
  })
}

export function useTestConnection() {
  return useMutation({ mutationFn: api.testAIConnection })
}
