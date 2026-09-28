import {
  CheckCircle2,
  KeyRound,
  Loader2,
  PlugZap,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useMemo, useState } from 'react'

import { notify } from '@features/notifications'
import { ApiError } from '@shared/api/http'
import { useDebounce } from '@shared/hooks/useDebounce'
import { formatDateTime } from '@shared/lib/format'
import { cn } from '@shared/lib/utils'
import { Button } from '@shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card'
import { FormField } from '@shared/ui/form-field'
import { FormError } from '@shared/ui/form-message'
import { Input } from '@shared/ui/input'
import { Skeleton } from '@shared/ui/skeleton'
import { StatusBadge } from '@shared/ui/status-badge'
import { Textarea } from '@shared/ui/textarea'

import { useAvailableModels, useTestConnection, useUpdateAIConfig } from '../api/settings.queries'
import { type AIConfig, type AIConfigUpdate, OPENROUTER_DEFAULT_URL } from '../model/types'

interface Draft {
  baseUrl: string
  newKey: string
  clearKey: boolean
  allowed: string[]
  defaultModel: string | null
  systemPrompt: string
  temperature: string
  maxTokens: string
  historyMessages: string
}

const fromConfig = (c: AIConfig): Draft => ({
  baseUrl: c.base_url,
  newKey: '',
  clearKey: false,
  allowed: c.allowed_models,
  defaultModel: c.default_model,
  systemPrompt: c.system_prompt,
  temperature: String(c.temperature),
  maxTokens: String(c.max_tokens),
  historyMessages: String(c.history_messages),
})

type Errors = Partial<
  Record<
    | 'baseUrl'
    | 'newKey'
    | 'systemPrompt'
    | 'temperature'
    | 'maxTokens'
    | 'historyMessages'
    | 'models',
    string
  >
>

function validate(d: Draft): Errors {
  const errors: Errors = {}
  if (!/^https?:\/\/.+/.test(d.baseUrl.trim()))
    errors.baseUrl = 'Enter a full URL, e.g. https://openrouter.ai/api/v1'
  if (d.newKey && d.newKey.trim().length < 10)
    errors.newKey = 'That does not look like an OpenRouter API key.'
  if (!d.systemPrompt.trim()) errors.systemPrompt = 'The system prompt is required.'
  const t = Number(d.temperature)
  if (Number.isNaN(t) || t < 0 || t > 2) errors.temperature = 'Between 0 and 2.'
  const m = Number(d.maxTokens)
  if (!Number.isInteger(m) || m < 64 || m > 8192) errors.maxTokens = 'Between 64 and 8192.'
  const h = Number(d.historyMessages)
  if (!Number.isInteger(h) || h < 2 || h > 100) errors.historyMessages = 'Between 2 and 100.'
  if (d.allowed.length > 0 && !d.defaultModel) errors.models = 'Choose a default model.'
  return errors
}

/** Only the fields that changed; the key only when a new one was typed (it's write-only). */
function diff(c: AIConfig, d: Draft): AIConfigUpdate {
  const body: AIConfigUpdate = {}
  if (d.baseUrl.trim() !== c.base_url) body.base_url = d.baseUrl.trim()
  if (d.clearKey) body.clear_api_key = true
  else if (d.newKey.trim()) body.api_key = d.newKey.trim()
  if (JSON.stringify(d.allowed) !== JSON.stringify(c.allowed_models))
    body.allowed_models = d.allowed
  if (d.defaultModel !== c.default_model) body.default_model = d.defaultModel
  if (d.systemPrompt !== c.system_prompt) body.system_prompt = d.systemPrompt
  if (Number(d.temperature) !== c.temperature) body.temperature = Number(d.temperature)
  if (Number(d.maxTokens) !== c.max_tokens) body.max_tokens = Number(d.maxTokens)
  if (Number(d.historyMessages) !== c.history_messages)
    body.history_messages = Number(d.historyMessages)
  return body
}

export function AISettingsForm({ config }: { config: AIConfig }) {
  const [draft, setDraft] = useState<Draft>(() => fromConfig(config))
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const update = useUpdateAIConfig()
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const changes = diff(config, draft)
  const dirty = Object.keys(changes).length > 0

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const found = validate(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setServerError(null)
    try {
      await update.mutateAsync(changes)
      notify.success('AI settings saved')
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Could not save the AI settings.')
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} noValidate className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Sparkles className="size-5 text-ai" aria-hidden />
        <h2 className="text-xl font-semibold">AI model</h2>
        {config.configured ? (
          <StatusBadge tone="success">Configured</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Not configured</StatusBadge>
        )}
        {config.updated_at && config.updated_by && (
          <span className="text-xs text-muted-foreground">
            Last changed by <span dir="auto">{config.updated_by.full_name}</span>,{' '}
            {formatDateTime(config.updated_at)}
          </span>
        )}
      </div>

      <FormError message={serverError} />

      <ConnectionCard config={config} draft={draft} errors={errors} set={set} />
      <ModelsCard config={config} draft={draft} error={errors.models} set={set} />
      <BehaviorCard draft={draft} errors={errors} set={set} />

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t bg-background/95 px-1 py-4 backdrop-blur">
        {dirty && <span className="text-sm text-muted-foreground">You have unsaved changes.</span>}
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || update.isPending}
          onClick={() => {
            setDraft(fromConfig(config))
            setErrors({})
          }}
        >
          <RotateCcw aria-hidden />
          Discard
        </Button>
        <Button type="submit" disabled={!dirty || update.isPending}>
          {update.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Save AI settings
        </Button>
      </div>
    </form>
  )
}

type SetDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => void

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">{children}</CardContent>
    </Card>
  )
}

function ConnectionCard({
  config,
  draft,
  errors,
  set,
}: {
  config: AIConfig
  draft: Draft
  errors: Errors
  set: SetDraft
}) {
  const test = useTestConnection()
  const runTest = () =>
    test.mutate({
      base_url: draft.baseUrl.trim() || undefined,
      // Test the typed key if there is one, otherwise the saved key (server side).
      api_key: draft.newKey.trim() || undefined,
    })

  const keyStatus = draft.clearKey ? (
    <StatusBadge tone="danger">Will be removed on save</StatusBadge>
  ) : config.api_key_unreadable ? (
    <StatusBadge tone="danger">Stored key can't be read. Enter it again</StatusBadge>
  ) : config.api_key_set ? (
    <StatusBadge tone="success">Key set ({config.api_key_hint})</StatusBadge>
  ) : (
    <StatusBadge tone="warning">No key</StatusBadge>
  )

  return (
    <Section
      title="OpenRouter connection"
      description="The API key is stored encrypted on the server and is never shown again or sent to browsers."
    >
      <FormField
        id="ai-base-url"
        label="API base URL"
        error={errors.baseUrl}
        hint="Leave the default unless you use a proxy or mirror."
      >
        <div className="flex gap-2">
          <Input
            id="ai-base-url"
            value={draft.baseUrl}
            onChange={(e) => set('baseUrl', e.target.value)}
            aria-invalid={!!errors.baseUrl}
            aria-describedby={errors.baseUrl ? 'ai-base-url-error' : 'ai-base-url-hint'}
            className="font-mono text-sm"
          />
          {draft.baseUrl !== OPENROUTER_DEFAULT_URL && (
            <Button
              type="button"
              variant="outline"
              onClick={() => set('baseUrl', OPENROUTER_DEFAULT_URL)}
            >
              Reset
            </Button>
          )}
        </div>
      </FormField>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">API key</span>
          {keyStatus}
        </div>
        <FormField
          id="ai-api-key"
          label={config.api_key_set ? 'Replace API key' : 'Enter API key'}
          error={errors.newKey}
          hint="Create one at openrouter.ai → Keys. Paste it here; it will not be displayed again."
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <KeyRound
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="ai-api-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-or-v1-…"
                value={draft.newKey}
                disabled={draft.clearKey}
                onChange={(e) => set('newKey', e.target.value)}
                aria-invalid={!!errors.newKey}
                aria-describedby={errors.newKey ? 'ai-api-key-error' : 'ai-api-key-hint'}
                className="pl-9 font-mono text-sm"
              />
            </div>
            {config.api_key_set && (
              <Button
                type="button"
                variant="outline"
                className={cn(draft.clearKey ? '' : 'text-danger hover:text-danger')}
                onClick={() => {
                  set('clearKey', !draft.clearKey)
                  set('newKey', '')
                }}
              >
                {draft.clearKey ? <RotateCcw aria-hidden /> : <Trash2 aria-hidden />}
                {draft.clearKey ? 'Keep key' : 'Remove key'}
              </Button>
            )}
          </div>
        </FormField>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={runTest}
          disabled={test.isPending || (!draft.newKey.trim() && !config.api_key_set)}
        >
          {test.isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <PlugZap aria-hidden />
          )}
          Test connection
        </Button>
        {test.data && (
          <p
            role="status"
            className={cn(
              'flex items-center gap-1.5 text-sm',
              test.data.ok ? 'text-success' : 'text-danger',
            )}
          >
            {test.data.ok ? (
              <CheckCircle2 className="size-4" aria-hidden />
            ) : (
              <XCircle className="size-4" aria-hidden />
            )}
            {test.data.message}
          </p>
        )}
        {test.isError && <p className="text-sm text-danger">{test.error.message}</p>}
      </div>
    </Section>
  )
}

function ModelsCard({
  config,
  draft,
  error,
  set,
}: {
  config: AIConfig
  draft: Draft
  error?: string
  set: SetDraft
}) {
  const canLoad = config.api_key_set && !config.api_key_unreadable
  const models = useAvailableModels(canLoad)
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim().toLowerCase(), 150)

  const rows = useMemo(() => {
    const catalog = models.data ?? []
    const known = new Set(catalog.map((m) => m.id))
    // Keep allowed models visible even if they disappeared from the catalog.
    const missing = draft.allowed
      .filter((id) => !known.has(id))
      .map((id) => ({ id, name: id, missing: true }))
    const all = [...missing, ...catalog.map((m) => ({ id: m.id, name: m.name, missing: false }))]
    return q
      ? all.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      : all
  }, [models.data, draft.allowed, q])

  const toggle = (id: string, on: boolean) => {
    const allowed = on ? [...draft.allowed, id] : draft.allowed.filter((m) => m !== id)
    set('allowed', allowed)
    if (!on && draft.defaultModel === id) set('defaultModel', allowed[0] ?? null)
    if (on && !draft.defaultModel) set('defaultModel', id)
  }

  return (
    <Section
      title="Models"
      description="Choose which free OpenRouter models users can pick in chat, and the default."
    >
      {!canLoad ? (
        <p className="rounded-md bg-surface-muted p-4 text-sm text-muted-foreground">
          Save an API key first. The list of free models is loaded from OpenRouter with that key.
        </p>
      ) : models.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : models.isError ? (
        <FormError message={models.error.message} />
      ) : (
        <>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder={`Search ${models.data.length} free models…`}
              aria-label="Search models"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div
            className="max-h-80 overflow-y-auto rounded-md border"
            role="group"
            aria-label="Free models"
          >
            {rows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No models match.</p>
            ) : (
              rows.map((m) => {
                const allowed = draft.allowed.includes(m.id)
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'flex items-center gap-3 border-b px-3 py-2 last:border-b-0',
                      allowed && 'bg-primary-light/40',
                    )}
                  >
                    <input
                      type="checkbox"
                      id={`allow-${m.id}`}
                      checked={allowed}
                      onChange={(e) => toggle(m.id, e.target.checked)}
                      className="size-4 accent-[var(--egsa-blue)]"
                    />
                    <label htmlFor={`allow-${m.id}`} className="min-w-0 flex-1 cursor-pointer">
                      <span className="block truncate text-sm font-medium text-navy">{m.name}</span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {m.id}
                      </span>
                    </label>
                    {m.missing && <StatusBadge tone="warning">Not in catalog</StatusBadge>}
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="radio"
                        name="default-model"
                        checked={draft.defaultModel === m.id}
                        disabled={!allowed}
                        onChange={() => set('defaultModel', m.id)}
                        className="size-3.5 accent-[var(--egsa-blue)]"
                        aria-label={`Use ${m.name} as the default model`}
                      />
                      Default
                    </label>
                  </div>
                )
              })
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {draft.allowed.length} allowed
            {draft.defaultModel && (
              <>
                {' · '}default <span className="font-mono">{draft.defaultModel}</span>
              </>
            )}
          </p>
        </>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </Section>
  )
}

function BehaviorCard({ draft, errors, set }: { draft: Draft; errors: Errors; set: SetDraft }) {
  return (
    <Section
      title="Assistant behaviour"
      description="How the assistant answers. Safety rules (no claims of access to EgSA documents; reply in the user's language) are always added."
    >
      <FormField id="ai-system-prompt" label="System prompt" error={errors.systemPrompt}>
        <Textarea
          id="ai-system-prompt"
          rows={5}
          value={draft.systemPrompt}
          onChange={(e) => set('systemPrompt', e.target.value)}
          aria-invalid={!!errors.systemPrompt}
        />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-3">
        <FormField
          id="ai-temperature"
          label="Temperature"
          error={errors.temperature}
          hint="0 = focused, 2 = creative"
        >
          <Input
            id="ai-temperature"
            type="number"
            step="0.1"
            min={0}
            max={2}
            value={draft.temperature}
            onChange={(e) => set('temperature', e.target.value)}
            aria-invalid={!!errors.temperature}
          />
        </FormField>
        <FormField id="ai-max-tokens" label="Max answer tokens" error={errors.maxTokens}>
          <Input
            id="ai-max-tokens"
            type="number"
            min={64}
            max={8192}
            value={draft.maxTokens}
            onChange={(e) => set('maxTokens', e.target.value)}
            aria-invalid={!!errors.maxTokens}
          />
        </FormField>
        <FormField
          id="ai-history"
          label="History messages"
          error={errors.historyMessages}
          hint="Recent messages sent as context"
        >
          <Input
            id="ai-history"
            type="number"
            min={2}
            max={100}
            value={draft.historyMessages}
            onChange={(e) => set('historyMessages', e.target.value)}
            aria-invalid={!!errors.historyMessages}
          />
        </FormField>
      </div>
    </Section>
  )
}
