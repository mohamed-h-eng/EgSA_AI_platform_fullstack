import { z } from 'zod'

import { DOCUMENT_STATUSES } from './types'

export const CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,63}$/

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(CODE_PATTERN, 'Letters, digits, dots, hyphens or underscores, e.g. EPS-SRS-001.')

const status = z.enum(DOCUMENT_STATUSES as [string, ...string[]])

export const documentMetadataSchema = z.object({
  project_id: z.string().min(1, 'Choose a project.'),
  code,
  title: z.string().trim().min(1, 'Enter a title.').max(300),
  category: z.string(),
  revision: z.string().trim().max(16),
  status,
  description: z.string().trim().max(5000),
})
export type DocumentMetadataValues = z.infer<typeof documentMetadataSchema>

export const editDocumentSchema = documentMetadataSchema.omit({ project_id: true })
export type EditDocumentValues = z.infer<typeof editDocumentSchema>

/** Suggest a code/title from a filename like "EPS-SRS-001 Battery requirements.pdf". */
export function suggestFromFilename(filename: string): { code: string; title: string } {
  const stem = filename.replace(/\.[^.]+$/, '').trim()
  const [first, ...rest] = stem.split(/\s+/)
  const candidate = (first ?? '').toUpperCase()
  if (CODE_PATTERN.test(candidate) && /\d/.test(candidate) && rest.length > 0) {
    return { code: candidate, title: rest.join(' ') }
  }
  return { code: CODE_PATTERN.test(stem.toUpperCase()) ? stem.toUpperCase() : '', title: stem }
}
