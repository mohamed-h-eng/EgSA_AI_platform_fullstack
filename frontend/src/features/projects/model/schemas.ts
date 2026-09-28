import { z } from 'zod'

import { PROJECT_STATUSES } from './types'

export const projectSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{1,31}$/, '2–32 letters, digits or hyphens, e.g. NEXSAT-1.'),
  name: z.string().trim().min(1, 'Enter the project name.').max(200),
  subsystem: z.string().trim().max(100),
  description: z.string().trim().max(5000),
  status: z.enum(PROJECT_STATUSES as [string, ...string[]]),
})
export type ProjectValues = z.infer<typeof projectSchema>
