import { PageHeader } from '@shared/layout/PageHeader'
import { FormError } from '@shared/ui/form-message'
import { Skeleton } from '@shared/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs'

import { useAIConfig, useUploadSettings } from '../api/settings.queries'
import { AISettingsForm } from '../components/AISettingsForm'
import { UploadSettingsForm } from '../components/UploadSettingsForm'

/** Admin Settings (plan §30): AI model connection and document upload limits. */
export function AdminSettingsPage() {
  return (
    <>
      <PageHeader title="Admin Settings" subtitle="Platform configuration for administrators." />
      <Tabs defaultValue="ai">
        <TabsList className="mb-6">
          <TabsTrigger value="ai">AI model</TabsTrigger>
          <TabsTrigger value="uploads">Uploads</TabsTrigger>
        </TabsList>
        <TabsContent value="ai">
          <AISection />
        </TabsContent>
        <TabsContent value="uploads">
          <UploadsSection />
        </TabsContent>
      </Tabs>
    </>
  )
}

function AISection() {
  const { data: config, isPending, isError, error } = useAIConfig()
  if (isPending) return <Skeleton className="h-96 w-full rounded-xl" />
  if (isError) return <FormError message={error.message} />
  // Remount when the saved config changes so the form restarts from server values.
  return <AISettingsForm key={config.updated_at ?? 'new'} config={config} />
}

function UploadsSection() {
  const { data: settings, isPending, isError, error } = useUploadSettings()
  if (isPending) return <Skeleton className="h-72 w-full rounded-xl" />
  if (isError) return <FormError message={error.message} />
  return <UploadSettingsForm key={settings.updated_at ?? 'env'} settings={settings} />
}
