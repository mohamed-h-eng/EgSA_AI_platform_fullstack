import { z } from 'zod'

const email = z
  .string()
  .trim()
  .min(1, 'Enter an email address.')
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Enter a valid email address.')

const fullName = z.string().trim().min(1, 'Enter the full name.').max(200)
const jobTitle = z.string().trim().max(200)

export const TEMP_PASSWORD_MIN = 10

export const createUserSchema = z.object({
  full_name: fullName,
  email,
  job_title: jobTitle,
  role: z.string().min(1, 'Choose a role.'),
  temporary_password: z.string().refine((v) => v === '' || v.length >= TEMP_PASSWORD_MIN, {
    message: `Use at least ${TEMP_PASSWORD_MIN} characters, or leave empty to generate one.`,
  }),
})
export type CreateUserValues = z.infer<typeof createUserSchema>

export const editUserSchema = z.object({
  full_name: fullName,
  email,
  job_title: jobTitle,
})
export type EditUserValues = z.infer<typeof editUserSchema>
