import type { StatusTone } from '@shared/ui/status-badge'

/** Mirrors backend `schemas/documents.py`. */
export type DocumentStatus = 'draft' | 'pending_review' | 'approved' | 'obsolete'
export type FileType = 'pdf' | 'docx' | 'txt'

export interface Category {
  code: string
  name: string
}

export interface DocumentItem {
  id: string
  code: string
  title: string
  description: string | null
  revision: string | null
  status: DocumentStatus
  category: Category | null
  project: { id: string; code: string; name: string }
  file_type: FileType
  size_bytes: number
  original_filename: string
  uploaded_by: { id: string; full_name: string; email: string } | null
  created_at: string
  updated_at: string
  abilities: { can_edit: boolean; can_delete: boolean }
}

export interface UploadConfig {
  max_upload_bytes: number
  allowed_types: string[]
}

export interface DocumentFilters {
  q: string
  projectId: string | null
  category: string
  type: FileType | ''
  status: DocumentStatus | ''
  page: number
}

export const STATUS_META: Record<DocumentStatus, { label: string; tone: StatusTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_review: { label: 'Pending Review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  obsolete: { label: 'Obsolete', tone: 'danger' },
}
export const DOCUMENT_STATUSES = Object.keys(STATUS_META) as DocumentStatus[]

export const FILE_TYPES: FileType[] = ['pdf', 'docx', 'txt']

/** Types the browser can show in a tab; DOCX always downloads. */
export const VIEWABLE: FileType[] = ['pdf', 'txt']
