import { toast } from 'sonner'

import { ApiError } from '@shared/api/http'

/** App-wide toast notifications (plan §29). Features call these instead of sonner directly. */
export const notify = {
  success: (message: string, description?: string) => toast.success(message, { description }),
  info: (message: string, description?: string) => toast.info(message, { description }),
  warning: (message: string, description?: string) => toast.warning(message, { description }),
  error: (message: string, description?: string) => toast.error(message, { description }),
  /** Show the server's (user-friendly) message for an ApiError, or a fallback. */
  apiError: (error: unknown, fallback = 'Something went wrong. Please try again.') =>
    toast.error(error instanceof ApiError ? error.message : fallback),
}
