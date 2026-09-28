import { FileText, Search, Upload } from 'lucide-react'
import { useState } from 'react'

import { Can } from '@features/auth'
import { ProjectSelect } from '@features/projects'
import { useDebounce } from '@shared/hooks/useDebounce'
import { Button } from '@shared/ui/button'
import { FormError } from '@shared/ui/form-message'
import { Input } from '@shared/ui/input'
import { PaginationBar } from '@shared/ui/pagination-bar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'

import { DOCUMENTS_PAGE_SIZE } from '../api/documents.api'
import { useCategories, useDocuments } from '../api/documents.queries'
import {
  DOCUMENT_STATUSES,
  type DocumentStatus,
  FILE_TYPES,
  type FileType,
  STATUS_META,
} from '../model/types'
import { DocumentDrawer } from './DocumentDrawer'
import { DocumentsTable } from './DocumentsTable'
import { UploadDocumentDialog } from './UploadDocumentDialog'

const ALL = 'all'

interface DocumentLibraryProps {
  /** Scope the library to one project (the project page's Documents tab). */
  projectId?: string
  /** Whether the user may upload here (e.g. false for a project Viewer). Default true. */
  canContribute?: boolean
  /** Controlled selection (lets the page sync the open document with the URL). */
  selectedId?: string | null
  onSelectedIdChange?: (id: string | null) => void
  /** Search text to start with (e.g. from the header search). */
  initialSearch?: string
}

export function DocumentLibrary({
  projectId,
  canContribute = true,
  selectedId: controlledId,
  onSelectedIdChange,
  initialSearch = '',
}: DocumentLibraryProps) {
  const [search, setSearch] = useState(initialSearch)
  const [projectFilter, setProjectFilter] = useState<string | null>(null)
  const [category, setCategory] = useState(ALL)
  const [type, setType] = useState<FileType | typeof ALL>(ALL)
  const [status, setStatus] = useState<DocumentStatus | typeof ALL>(ALL)
  const [page, setPage] = useState(1)
  const [uploading, setUploading] = useState(false)
  const [localId, setLocalId] = useState<string | null>(null)
  const selectedId = controlledId !== undefined ? controlledId : localId
  const select = onSelectedIdChange ?? setLocalId

  const q = useDebounce(search)
  const { data: categories = [] } = useCategories()
  const { data, isPending, isError, error, isPlaceholderData } = useDocuments({
    q,
    projectId: projectId ?? projectFilter,
    category: category === ALL ? '' : category,
    type: type === ALL ? '' : type,
    status: status === ALL ? '' : status,
    page,
  })
  const filtered = !!q || !!projectFilter || category !== ALL || type !== ALL || status !== ALL

  const onFilter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setPage(1)
    }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            dir="auto"
            placeholder="Search code, title or description…"
            aria-label="Search documents"
            value={search}
            onChange={(e) => onFilter(setSearch)(e.target.value)}
            className="pl-9"
          />
        </div>
        {!projectId && (
          <ProjectSelect
            value={projectFilter}
            onChange={onFilter(setProjectFilter)}
            noneLabel="All projects"
            className="w-44"
            aria-label="Filter by project"
          />
        )}
        <Select value={category} onValueChange={onFilter(setCategory)}>
          <SelectTrigger className="w-40" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => onFilter(setType)(v as FileType | typeof ALL)}>
          <SelectTrigger className="w-32" aria-label="Filter by file type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {FILE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => onFilter(setStatus)(v as DocumentStatus | typeof ALL)}
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {DOCUMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canContribute && (
          <Can permission="documents:upload">
            <Button onClick={() => setUploading(true)} className="ml-auto">
              <Upload aria-hidden />
              Upload
            </Button>
          </Can>
        )}
      </div>

      {isError ? (
        <div className="p-6">
          <FormError message={error.message} />
        </div>
      ) : data && data.total === 0 ? (
        <EmptyState filtered={filtered} />
      ) : (
        <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
          <DocumentsTable
            documents={data?.items}
            loading={isPending}
            selectedId={selectedId}
            onSelect={select}
            showProject={!projectId}
          />
        </div>
      )}

      {data && data.total > 0 && (
        <PaginationBar
          page={data.page}
          pageSize={DOCUMENTS_PAGE_SIZE}
          total={data.total}
          onPageChange={setPage}
          noun="documents"
        />
      )}

      <DocumentDrawer documentId={selectedId} onClose={() => select(null)} />
      <UploadDocumentDialog open={uploading} onOpenChange={setUploading} projectId={projectId} />
    </div>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <FileText className="size-10 text-muted-foreground/60" aria-hidden />
      <p className="font-medium text-navy">
        {filtered ? 'No documents match your filters' : 'No documents yet'}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {filtered
          ? 'Try a different search or clear the filters.'
          : 'Documents uploaded to your projects will appear here.'}
      </p>
    </div>
  )
}
