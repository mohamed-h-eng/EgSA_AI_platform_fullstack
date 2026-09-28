import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { EditDocumentValues } from '../model/schemas'
import type { DocumentFilters, DocumentItem } from '../model/types'
import * as api from './documents.api'

export const documentsKeys = {
  all: ['documents'] as const,
  lists: () => [...documentsKeys.all, 'list'] as const,
  list: (filters: DocumentFilters) => [...documentsKeys.lists(), filters] as const,
  detail: (id: string) => [...documentsKeys.all, 'detail', id] as const,
  categories: () => ['document-categories'] as const,
  uploadConfig: () => ['document-upload-config'] as const,
}

export function useDocuments(filters: DocumentFilters, enabled = true) {
  return useQuery({
    queryKey: documentsKeys.list(filters),
    queryFn: () => api.listDocuments(filters),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useDocument(id: string | null) {
  return useQuery({
    queryKey: documentsKeys.detail(id ?? ''),
    queryFn: () => api.getDocument(id!),
    enabled: !!id,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: documentsKeys.categories(),
    queryFn: api.listCategories,
    staleTime: Infinity,
  })
}

export function useUploadConfig() {
  return useQuery({
    queryKey: documentsKeys.uploadConfig(),
    queryFn: api.getUploadConfig,
    staleTime: 5 * 60_000,
  })
}

/** Documents change project document counts too, so refresh project queries as well. */
function useRefreshAfterChange() {
  const queryClient = useQueryClient()
  return (doc?: DocumentItem) => {
    if (doc) queryClient.setQueryData(documentsKeys.detail(doc.id), doc)
    void queryClient.invalidateQueries({ queryKey: documentsKeys.lists() })
    void queryClient.invalidateQueries({ queryKey: ['projects'] })
  }
}

export function useUploadDocument() {
  const refresh = useRefreshAfterChange()
  return useMutation({
    mutationFn: (args: Parameters<typeof api.uploadDocument>) => api.uploadDocument(...args),
    onSuccess: refresh,
  })
}

export function useUpdateDocument(id: string) {
  const refresh = useRefreshAfterChange()
  return useMutation({
    mutationFn: (values: EditDocumentValues) => api.updateDocument(id, values),
    onSuccess: refresh,
  })
}

export function useDeleteDocument(id: string) {
  const queryClient = useQueryClient()
  const refresh = useRefreshAfterChange()
  return useMutation({
    mutationFn: () => api.deleteDocument(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: documentsKeys.detail(id) })
      refresh()
    },
  })
}
