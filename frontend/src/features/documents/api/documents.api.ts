import { http, httpBlob, httpUpload, type UploadOptions } from '@shared/api/http'
import type { Page } from '@shared/types/api'

import type { DocumentMetadataValues, EditDocumentValues } from '../model/schemas'
import type { Category, DocumentFilters, DocumentItem, UploadConfig } from '../model/types'

export const DOCUMENTS_PAGE_SIZE = 20

export function listDocuments(
  filters: DocumentFilters,
  pageSize = DOCUMENTS_PAGE_SIZE,
): Promise<Page<DocumentItem>> {
  const params = new URLSearchParams({ page: String(filters.page), page_size: String(pageSize) })
  if (filters.q.trim()) params.set('q', filters.q.trim())
  if (filters.projectId) params.set('project_id', filters.projectId)
  if (filters.category) params.set('category', filters.category)
  if (filters.type) params.set('type', filters.type)
  if (filters.status) params.set('status', filters.status)
  return http(`/documents?${params}`)
}

export function getDocument(id: string): Promise<DocumentItem> {
  return http(`/documents/${id}`)
}

export function listCategories(): Promise<Category[]> {
  return http('/documents/categories')
}

export function getUploadConfig(): Promise<UploadConfig> {
  return http('/documents/upload-config')
}

export function uploadDocument(
  file: File,
  values: DocumentMetadataValues,
  options?: UploadOptions,
): Promise<DocumentItem> {
  const form = new FormData()
  form.set('file', file)
  form.set('project_id', values.project_id)
  form.set('code', values.code)
  form.set('title', values.title)
  form.set('status', values.status)
  if (values.category) form.set('category', values.category)
  if (values.revision) form.set('revision', values.revision)
  if (values.description) form.set('description', values.description)
  return httpUpload('/documents', form, options)
}

export function updateDocument(id: string, values: EditDocumentValues): Promise<DocumentItem> {
  return http(`/documents/${id}`, {
    method: 'PATCH',
    json: {
      code: values.code,
      title: values.title,
      status: values.status,
      category: values.category || null,
      revision: values.revision || null,
      description: values.description || null,
    },
  })
}

export function deleteDocument(id: string): Promise<void> {
  return http(`/documents/${id}`, { method: 'DELETE' })
}

export function downloadDocument(id: string, inline = false) {
  return httpBlob(`/documents/${id}/download${inline ? '?inline=true' : ''}`)
}
