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
 * Header search (Ctrl+K / ⌘K). POC scope: hands the text to a list page's own search
 * (documents first) instead of a unified index. Targets come from the app, filtered by permission.
 */
export function GlobalSearch({ targets }: { targets: SearchTarget[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (targets.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [targets.length])

  if (targets.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Control+K"
        className="flex h-9 items-center gap-2 rounded-md border bg-surface-muted px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:w-72"
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden sm:inline">Search documents, projects…</span>
        <span className="sr-only sm:hidden">Search</span>
        <kbd className="ms-auto hidden rounded border bg-surface px-1.5 font-mono text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          {/* Mounted only while open, so every search starts empty. */}
          {open && <SearchForm targets={targets} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
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
