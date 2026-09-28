import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { notify } from '@features/notifications'
import { ApiError } from '@shared/api/http'
import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog'
import { FormError } from '@shared/ui/form-message'

import { useUpdateDocument } from '../api/documents.queries'
import { type EditDocumentValues, editDocumentSchema } from '../model/schemas'
import type { DocumentItem } from '../model/types'
import { MetadataFields } from './MetadataFields'

interface EditDocumentDialogProps {
  document: DocumentItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditDocumentDialog({ document, open, onOpenChange }: EditDocumentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <EditForm document={document} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function EditForm({ document, onDone }: { document: DocumentItem; onDone: () => void }) {
  const update = useUpdateDocument(document.id)
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EditDocumentValues>({
    resolver: zodResolver(editDocumentSchema),
    defaultValues: {
      code: document.code,
      title: document.title,
      category: document.category?.code ?? '',
      revision: document.revision ?? '',
      status: document.status,
      description: document.description ?? '',
    },
  })

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await update.mutateAsync(values)
      notify.success('Document updated')
      onDone()
    } catch (error) {
      if (error instanceof ApiError && error.code === 'DOCUMENT_CODE_EXISTS') {
        setError('code', { message: error.message })
      } else {
        setServerError(error instanceof ApiError ? error.message : 'Could not save the changes.')
      }
    }
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Edit document</DialogTitle>
        <DialogDescription>
          Update the metadata of {document.code} in {document.project.code}. The file itself can't
          be replaced.
        </DialogDescription>
      </DialogHeader>
      <FormError message={serverError} />
      <MetadataFields idPrefix="edit-doc" register={register} control={control} errors={errors} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Save changes
        </Button>
      </DialogFooter>
    </form>
  )
}
