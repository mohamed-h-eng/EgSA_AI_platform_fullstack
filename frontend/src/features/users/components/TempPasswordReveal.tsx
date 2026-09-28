import { Check, Copy, KeyRound } from 'lucide-react'
import { useState } from 'react'

import { copyText } from '@shared/lib/clipboard'
import { Button } from '@shared/ui/button'

interface TempPasswordRevealProps {
  password: string
  userName: string
}

/** Shows a temporary password exactly once (decision D9). It is never retrievable again. */
export function TempPasswordReveal({ password, userName }: TempPasswordRevealProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (await copyText(password)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-lg border bg-surface-muted p-4">
        <KeyRound className="size-5 shrink-0 text-primary" aria-hidden />
        <code
          className="flex-1 font-mono text-lg tracking-wider text-navy select-all"
          aria-label="Temporary password"
        >
          {password}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          Share it with <span dir="auto">{userName}</span> through a secure channel.
        </li>
        <li>They must set a new password when they first sign in.</li>
        <li>This password will not be shown again.</li>
      </ul>
    </div>
  )
}
