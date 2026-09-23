import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 10

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email.'),
  password: z.string().min(1, 'Enter your password.'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password.'),
    new_password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
      .max(128, 'Use at most 128 characters.'),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match.',
  })
  .refine((v) => v.new_password !== v.current_password, {
    path: ['new_password'],
    message: 'New password must be different from the current one.',
  })
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
