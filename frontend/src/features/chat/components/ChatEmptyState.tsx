import { Sparkles } from 'lucide-react'

import { ProjectSelect } from '@features/projects'

const SUGGESTIONS = [
  'Explain typical undervoltage protection for a Li-ion satellite battery.',
  'Draft a checklist for an electrical power system design review.',
  'What drives the ground resolution of a spaceborne SAR?',
  'اشرح مراحل اختبار التفريغ الحراري للأقمار الصناعية',
]

interface ChatEmptyStateProps {
  projectId: string | null
  onProjectChange: (projectId: string | null) => void
  onSuggestion: (text: string) => void
  disabled: boolean
}

/** New chat: optional project link + suggested prompts. Makes no claims about document
 *  knowledge: there is no RAG yet (plan §25). */
export function ChatEmptyState({
  projectId,
  onProjectChange,
  onSuggestion,
  disabled,
}: ChatEmptyStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-ai/10 text-ai">
        <Sparkles className="size-6" aria-hidden />
      </div>
      <div>
        <h1 className="text-2xl font-bold">EgSA AI Assistant</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask general engineering questions. The assistant does not have access to EgSA documents
          yet.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-1.5 text-left">
        <label htmlFor="chat-project" className="text-sm font-medium">
          Project (optional)
        </label>
        <ProjectSelect
          id="chat-project"
          value={projectId}
          onChange={onProjectChange}
          noneLabel="No project"
        />
        <p className="text-xs text-muted-foreground">
          Linking a project gives the assistant its name and subsystem as context.
        </p>
      </div>

      <div className="grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            dir="auto"
            disabled={disabled}
            onClick={() => onSuggestion(s)}
            className="rounded-lg border bg-surface px-4 py-3 text-start text-sm text-navy transition-colors hover:border-primary/40 hover:bg-primary-light/40 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
