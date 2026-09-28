import { SendHorizontal, Square } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'

import { Button } from '@shared/ui/button'
import { Textarea } from '@shared/ui/textarea'

const MAX_CHARS = 20_000

interface ChatComposerProps {
  onSend: (content: string) => void
  onStop: () => void
  busy: boolean
  streaming: boolean
  disabled?: boolean
  disabledReason?: string
}

export function ChatComposer({
  onSend,
  onStop,
  busy,
  streaming,
  disabled,
  disabledReason,
}: ChatComposerProps) {
  const [value, setValue] = useState('')
  const canSend = !disabled && !busy && value.trim().length > 0 && value.length <= MAX_CHARS

  const submit = () => {
    if (!canSend) return
    onSend(value)
    setValue('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds a newline; respect IME composition (e.g. Arabic input).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex items-end gap-2 rounded-xl border bg-surface p-2 shadow-card focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
      <Textarea
        dir="auto"
        aria-label="Message"
        placeholder={disabled ? disabledReason : 'Ask about engineering…'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        autoFocus
        rows={1}
        className="max-h-48 min-h-10 flex-1 resize-none border-0 shadow-none focus-visible:ring-0"
      />
      {streaming ? (
        <Button type="button" variant="outline" onClick={onStop} aria-label="Stop generating">
          <Square className="fill-current" aria-hidden />
          Stop
        </Button>
      ) : (
        <Button type="button" onClick={submit} disabled={!canSend} aria-label="Send message">
          <SendHorizontal aria-hidden />
          Send
        </Button>
      )}
    </div>
  )
}
