import { Download, Eye, Loader2, Pencil, Trash2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'

import { notify } from '@features/notifications'
import { openPendingTab, saveBlob, showBlobInTab } from '@shared/lib/download'
import { formatBytes, formatDateTime } from '@shared/lib/format'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/confirm-dialog'
import { FileTypeIcon } from '@shared/ui/file-type-icon'
import { Separator } from '@shared/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@shared/ui/sheet'
import { Skeleton } from '@shared/ui/skeleton'

import { downloadDocument } from '../api/documents.api'
import { useDeleteDocument, useDocument } from '../api/documents.queries'
import { type DocumentItem, VIEWABLE } from '../model/types'
import { DocumentStatusBadge } from './DocumentStatusBadge'
import { EditDocumentDialog } from './EditDocumentDialog'

interface DocumentDrawerProps {
  documentId: string | null
  onClose: () => void
}

export function DocumentDrawer({ documentId, onClose }: DocumentDrawerProps) {
  const { data: document, isError } = useDocument(documentId)
  return (
    <Sheet open={!!documentId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {document ? (
          <DocumentDetails document={document} onDeleted={onClose} />
        ) : (
          <SheetHeader>
            <SheetTitle>{isError ? 'Document not found' : 'Loading document…'}</SheetTitle>
            <SheetDescription>
              {isError ? "It doesn't exist or you don't have access to its project." : ''}
            </SheetDescription>
            {!isError && <Skeleton className="mt-4 h-40 w-full" />}
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DocumentDetails({
  document,
  onDeleted,
}: {
  document: DocumentItem
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState<'view' | 'download' | null>(null)
  const remove = useDeleteDocument(document.id)
  const viewable = VIEWABLE.includes(document.file_type)

  const view = async () => {
    const tab = openPendingTab() // before awaiting, so pop-up blockers allow it
    setBusy('view')
    try {
      const { blob } = await downloadDocument(document.id, true)
      showBlobInTab(tab, blob)
    } catch (error) {
      tab?.close()
      notify.apiError(error, 'Could not open the document.')
    } finally {
      setBusy(null)
    }
  }

  const download = async () => {
    setBusy('download')
    try {
      const { blob, filename } = await downloadDocument(document.id)
      saveBlob(blob, filename ?? document.original_filename)
    } catch (error) {
      notify.apiError(error, 'Could not download the document.')
    } finally {
      setBusy(null)
    }
  }

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync()
      notify.success('Document deleted', document.code)
      setDeleting(false)
      onDeleted()
    } catch (error) {
      setDeleting(false)
      notify.apiError(error)
    }
  }

  return (
    <>
      <SheetHeader className="border-b pb-5">
        <div className="flex items-start gap-3">
          <FileTypeIcon type={document.file_type} className="mt-1" />
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-navy">{document.code}</p>
            <SheetTitle dir="auto" className="text-lg leading-snug">
              {document.title}
            </SheetTitle>
            <SheetDescription className="sr-only">Document details</SheetDescription>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DocumentStatusBadge status={document.status} />
          {document.revision && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Rev. {document.revision}
            </span>
          )}
        </div>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2">
          {viewable ? (
            <Button variant="outline" onClick={() => void view()} disabled={busy !== null}>
              {busy === 'view' ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Eye aria-hidden />
              )}
              View
            </Button>
          ) : (
            <span className="self-center text-xs text-muted-foreground">
              {document.file_type.toUpperCase()} files open after download.
            </span>
          )}
          <Button onClick={() => void download()} disabled={busy !== null}>
            {busy === 'download' ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Download aria-hidden />
            )}
            Download
          </Button>
        </div>

        {document.description && (
          <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">
            {document.description}
          </p>
        )}

        <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-3 text-sm">
          <Detail label="Project">
            <Link
              to={`/projects/${document.project.id}`}
              className="font-mono text-primary hover:underline"
            >
              {document.project.code}
            </Link>
          </Detail>
          <Detail label="Category">{document.category?.name ?? 'Uncategorized'}</Detail>
          <Detail label="File">
            <span dir="auto" className="break-all">
              {document.original_filename}
            </span>
            <span className="block text-xs text-muted-foreground">
              {formatBytes(document.size_bytes)}
            </span>
          </Detail>
          <Detail label="Uploaded by">
            <span dir="auto">{document.uploaded_by?.full_name ?? '—'}</span>
          </Detail>
          <Detail label="Uploaded">{formatDateTime(document.created_at)}</Detail>
          <Detail label="Updated">{formatDateTime(document.updated_at)}</Detail>
        </dl>

        {(document.abilities.can_edit || document.abilities.can_delete) && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              {document.abilities.can_edit && (
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => setEditing(true)}
                >
                  <Pencil aria-hidden />
                  Edit details
                </Button>
              )}
              {document.abilities.can_delete && (
                <Button
                  variant="outline"
                  className="justify-start text-danger hover:text-danger"
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 aria-hidden />
                  Delete document
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {document.abilities.can_edit && (
        <EditDocumentDialog document={document} open={editing} onOpenChange={setEditing} />
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${document.code}?`}
        description="The document and its file will be permanently deleted. This can't be undone."
        confirmLabel="Delete document"
        destructive
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-navy">{children}</dd>
    </>
  )
}
