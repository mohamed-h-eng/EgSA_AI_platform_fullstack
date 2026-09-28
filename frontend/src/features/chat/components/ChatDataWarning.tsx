import { ShieldAlert } from 'lucide-react'

/** Decision D2: permanent, non-dismissible notice above the composer. Amber, not red. */
export function ChatDataWarning() {
  return (
    <p
      role="note"
      className="flex items-center gap-2 rounded-md bg-warning/15 px-3 py-1.5 text-xs text-[#8a5a10]"
    >
      <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
      Do not enter classified or sensitive project data. Messages are sent to an external AI
      provider.
    </p>
  )
}
