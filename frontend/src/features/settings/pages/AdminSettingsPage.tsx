import { PageHeader } from '@shared/layout/PageHeader'
import { FormError } from '@shared/ui/form-message'
import { Skeleton } from '@shared/ui/skeleton'

import { useAIConfig } from '../api/settings.queries'
import { AISettingsForm } from '../components/AISettingsForm'

/** Admin Settings (plan §30). Phase 09 adds upload limits alongside the AI section. */
export function AdminSettingsPage() {
  const { data: config, isPending, isError, error } = useAIConfig()

  return (
    <>
      <PageHeader title="Admin Settings" subtitle="Platform configuration for administrators." />
      {isPending ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : isError ? (
        <FormError message={error.message} />
      ) : (
        // Remount when the saved config changes so the form restarts from server values.
        <AISettingsForm key={config.updated_at ?? 'new'} config={config} />
      )}
    </>
  )
}
