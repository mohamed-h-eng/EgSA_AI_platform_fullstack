import { zodResolver } from '@hookform/resolvers/zod'
import { FileUp, Loader2, X } from 'lucide-react'
import { type DragEvent, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { notify } from '@features/notifications'
import { ProjectSelect } from '@features/projects'
import { ApiError } from '@shared/api/http'
import { formatBytes } from '@shared/lib/format'
import { cn } from '@shared/lib/utils'
import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog'
import { FileTypeIcon } from '@shared/ui/file-type-icon'
import { FormField } from '@shared/ui/form-field'
import { FieldError, FormError } from '@shared/ui/form-message'

import { useUploadConfig, useUploadDocument } from '../api/documents.queries'
import {
  type DocumentMetadataValues,
  documentMetadataSchema,
  suggestFromFilename,
} from '../model/schemas'
import type { UploadConfig } from '../model/types'
import { MetadataFields } from './MetadataFields'

interface UploadDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-select (and lock) the project, e.g. when uploading from a project's Documents tab. */
  projectId?: string
}

export function UploadDocumentDialog({ open, onOpenChange, projectId }: UploadDocumentDialogProps) {
  const [uploading, setUploading] = useState(false)
  return (
    // While uploading, closing requires the explicit Cancel button (which aborts).
    <Dialog open={open} onOpenChange={(next) => !uploading && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <UploadForm
          projectId={projectId}
          onDone={() => onOpenChange(false)}
          onUploadingChange={setUploading}
        />
      </DialogContent>
    </Dialog>
  )
}

function fileProblem(file: File, config: UploadConfig | undefined): string | null {
  if (!config) return null
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
  if (!config.allowed_types.includes(ext)) {
    return `Only ${config.allowed_types.map((t) => t.toUpperCase()).join(', ')} files can be uploaded.`
  }
  if (file.size === 0) return 'The file is empty.'
  if (file.size > config.max_upload_bytes) {
    return `The file is ${formatBytes(file.size)}; the limit is ${formatBytes(config.max_upload_bytes)}.`
  }
  return null
}

function UploadForm({
  projectId,
  onDone,
  onUploadingChange,
}: {
  projectId?: string
  onDone: () => void
  onUploadingChange: (uploading: boolean) => void
}) {
  const { data: config } = useUploadConfig()
  const upload = useUploadDocument()
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [controller, setController] = useState<AbortController | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors },
  } = useForm<DocumentMetadataValues>({
    resolver: zodResolver(documentMetadataSchema),
    defaultValues: {
      project_id: projectId ?? '',
      code: '',
      title: '',
      category: '',
      revision: '',
      status: 'draft',
      description: '',
    },
  })

  const pickFile = (picked: File | undefined) => {
    if (!picked) return
    const problem = fileProblem(picked, config)
    setFile(problem ? null : picked)
    setFileError(problem)
    if (problem) return
    // Pre-fill code/title from the filename when the user hasn't typed them yet.
    const suggestion = suggestFromFilename(picked.name)
    if (!getValues('code') && suggestion.code) setValue('code', suggestion.code)
    if (!getValues('title')) setValue('title', suggestion.title)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pickFile(e.dataTransfer.files[0])
  }

  const submit = handleSubmit(async (values) => {
    if (!file) {
      setFileError('Choose a file to upload.')
      return
    }
    setServerError(null)
    const abort = new AbortController()
    setController(abort)
    onUploadingChange(true)
    setProgress(0)
    try {
      const doc = await upload.mutateAsync([
        file,
        values,
        { onProgress: setProgress, signal: abort.signal },
      ])
      notify.success('Document uploaded successfully', `${doc.code} · ${doc.project.code}`)
      onDone()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (error instanceof ApiError && error.code === 'DOCUMENT_CODE_EXISTS') {
        setError('code', { message: error.message })
      } else if (error instanceof ApiError && error.code.startsWith('FILE_')) {
        setFileError(error.message)
      } else {
        setServerError(
          error instanceof ApiError ? error.message : 'Upload failed. Please try again.',
        )
      }
    } finally {
      setController(null)
      setProgress(null)
      onUploadingChange(false)
    }
  })

  const uploading = progress !== null
  const accept = config?.allowed_types.map((t) => `.${t}`).join(',')

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Upload document</DialogTitle>
        <DialogDescription>
          {config
            ? `${config.allowed_types.map((t) => t.toUpperCase()).join(', ')} up to ${formatBytes(config.max_upload_bytes)}.`
            : 'Add a file to the engineering library.'}
        </DialogDescription>
      </DialogHeader>

      <FormError message={serverError} />

      {/* Drop zone */}
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border bg-surface-muted p-3">
          <FileTypeIcon type={file.name.split('.').pop() ?? ''} />
          <div className="min-w-0 flex-1">
            <p dir="auto" className="truncate text-sm font-medium text-navy">
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
          </div>
          {!uploading && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setFile(null)}
              aria-label="Remove file"
            >
              <X aria-hidden />
            </Button>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors',
            dragging ? 'border-primary bg-primary-light/50' : 'border-input',
          )}
        >
          <FileUp className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-navy">Drag a file here, or</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="sr-only"
            aria-label="File to upload"
            onChange={(e) => {
              pickFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      )}
      <FieldError id="upload-file-error" message={fileError ?? undefined} />

      <FormField id="upload-project" label="Project" error={errors.project_id?.message}>
        <Controller
          control={control}
          name="project_id"
          render={({ field }) => (
            <ProjectSelect
              id="upload-project"
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? '')}
              disabled={!!projectId}
              // Project viewers are read-only; admins (no membership) may upload anywhere.
              filter={(p) => p.my_role !== 'viewer'}
            />
          )}
        />
      </FormField>

      <MetadataFields idPrefix="upload" register={register} control={control} errors={errors} />

      {progress !== null && (
        <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">Uploading… {Math.round(progress * 100)}%</p>
        </div>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => (uploading ? controller?.abort() : onDone())}
        >
          {uploading ? 'Cancel upload' : 'Cancel'}
        </Button>
        <Button type="submit" disabled={uploading}>
          {uploading && <Loader2 className="animate-spin" aria-hidden />}
          Upload
        </Button>
      </DialogFooter>
    </form>
  )
}
