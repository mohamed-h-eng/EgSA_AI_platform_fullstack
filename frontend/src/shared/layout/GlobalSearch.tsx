import { Search } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog'
import { Input } from '@shared/ui/input'

export interface SearchTarget {
  label: string
  /** List page that reads `?q=`, e.g. "/documents". */
  path: string
}

/**
 * Search dialog (Ctrl+K / ⌘K anywhere; opened from the sidebar's Search entry). POC scope: hands
 * the text to a list page's own search (documents first) instead of a unified index. Targets come
 * from the app, filtered by permission.
 */
export function GlobalSearch({
  targets,
  open,
  onOpenChange,
}: {
  targets: SearchTarget[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  useEffect(() => {
    if (targets.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        onOpenChange(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [targets.length, onOpenChange])

  if (targets.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted only while open, so every search starts empty. */}
        {open && <SearchForm targets={targets} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function SearchForm({ targets, onDone }: { targets: SearchTarget[]; onDone: () => void }) {
  const [text, setText] = useState('')
  const navigate = useNavigate()

  const go = (target: SearchTarget) => {
    const q = text.trim()
    navigate(q ? `${target.path}?q=${encodeURIComponent(q)}` : target.path)
    onDone()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    go(targets[0])
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Search</DialogTitle>
        <DialogDescription>
          Press Enter to search {targets[0].label.toLowerCase()}.
        </DialogDescription>
      </DialogHeader>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          autoFocus
          dir="auto"
          type="search"
          aria-label="Search text"
          placeholder="Code, title, name…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {targets.map((t, i) => (
          <Button
            key={t.path}
            type={i === 0 ? 'submit' : 'button'}
            variant={i === 0 ? 'default' : 'outline'}
            onClick={i === 0 ? undefined : () => go(t)}
          >
            Search {t.label.toLowerCase()}
          </Button>
        ))}
      </div>
    </form>
  )
}
