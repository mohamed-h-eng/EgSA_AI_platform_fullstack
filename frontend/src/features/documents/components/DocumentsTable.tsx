import { formatRelative } from '@shared/lib/format'
import { cn } from '@shared/lib/utils'
import { FileTypeIcon } from '@shared/ui/file-type-icon'
import { Skeleton } from '@shared/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table'

import type { DocumentItem } from '../model/types'
import { DocumentStatusBadge } from './DocumentStatusBadge'

interface DocumentsTableProps {
  documents: DocumentItem[] | undefined
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  /** Hide the project column when the table is already scoped to one project. */
  showProject?: boolean
}

/** Engineering document table (design.md §21, §26). */
export function DocumentsTable({
  documents,
  loading,
  selectedId,
  onSelect,
  showProject = true,
}: DocumentsTableProps) {
  const columns = showProject ? 6 : 5
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-surface-muted hover:bg-surface-muted">
          <TableHead className="pl-4">Document</TableHead>
          {showProject && <TableHead>Project</TableHead>}
          <TableHead className="hidden lg:table-cell">Category</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Uploaded by</TableHead>
          <TableHead className="hidden md:table-cell">Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading && !documents
          ? Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={columns} className="pl-4">
                  <Skeleton className="h-10 w-full" />
                </TableCell>
              </TableRow>
            ))
          : documents?.map((doc) => (
              <TableRow
                key={doc.id}
                data-fit-row
                tabIndex={0}
                aria-selected={selectedId === doc.id}
                onClick={() => onSelect(doc.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(doc.id)
                  }
                }}
                className={cn(
                  'cursor-pointer hover:bg-primary-light/40 focus-visible:bg-primary-light/40 focus-visible:outline-none',
                  selectedId === doc.id && 'bg-primary-light/60',
                )}
              >
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <FileTypeIcon type={doc.file_type} />
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold text-navy">
                        {doc.code}
                        {doc.revision && (
                          <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
                            Rev. {doc.revision}
                          </span>
                        )}
                      </p>
                      <p dir="auto" className="max-w-md truncate text-sm text-muted-foreground">
                        {doc.title}
                      </p>
                    </div>
                  </div>
                </TableCell>
                {showProject && (
                  <TableCell>
                    <span className="rounded-md bg-primary-light px-2 py-0.5 font-mono text-xs font-medium text-primary">
                      {doc.project.code}
                    </span>
                  </TableCell>
                )}
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {doc.category?.name ?? '—'}
                </TableCell>
                <TableCell>
                  <DocumentStatusBadge status={doc.status} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span dir="auto">{doc.uploaded_by?.full_name ?? '—'}</span>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatRelative(doc.updated_at)}
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  )
}
