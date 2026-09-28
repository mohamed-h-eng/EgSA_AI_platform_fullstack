import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AIConfigUpdate, UploadSettingsUpdate } from '../model/types'
import * as api from './settings.api'

export const settingsKeys = {
  aiConfig: () => ['admin', 'ai-config'] as const,
  aiModels: (freeOnly: boolean) => ['admin', 'ai-models', freeOnly] as const,
  uploads: () => ['admin', 'upload-settings'] as const,
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

export function useUploadSettings() {
  return useQuery({ queryKey: settingsKeys.uploads(), queryFn: api.getUploadSettings })
}

export function useUpdateUploadSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UploadSettingsUpdate) => api.updateUploadSettings(body),
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsKeys.uploads(), settings)
      // The documents feature caches the effective limits for its upload dialog.
      void queryClient.invalidateQueries({ queryKey: ['document-upload-config'] })
    },
  })
}
