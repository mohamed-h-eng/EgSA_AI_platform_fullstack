import { cn } from '@shared/lib/utils'

/** Semantic file-type colors (design.md §26): PDF red, DOC/DOCX blue, XLS/XLSX green, TXT gray. */
const STYLES: Record<string, string> = {
  pdf: 'bg-danger/10 text-danger',
  doc: 'bg-primary-light text-primary',
  docx: 'bg-primary-light text-primary',
  xls: 'bg-success/10 text-success',
  xlsx: 'bg-success/10 text-success',
  txt: 'bg-muted text-muted-foreground',
}

export function FileTypeIcon({ type, className }: { type: string; className?: string }) {
  const key = type.toLowerCase()
  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tracking-wide uppercase',
        STYLES[key] ?? STYLES.txt,
        className,
      )}
      aria-label={`${key.toUpperCase()} file`}
      role="img"
    >
      {key.slice(0, 4)}
    </span>
  )
}
