import { useNavigate, useParams, useSearchParams } from 'react-router'

import { PageHeader } from '@shared/layout/PageHeader'

import { DocumentLibrary } from '../components/DocumentLibrary'

/** Engineering Library (design.md §31). /documents/:documentId opens that document's drawer. */
export function DocumentsPage() {
  const { documentId = null } = useParams()
  const navigate = useNavigate()
  // ?q= comes from the header search; a new search remounts the library with that text.
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''

  return (
    <>
      <PageHeader
        title="Engineering Library"
        subtitle="Access engineering documents, standards, and knowledge across EgSA's space projects."
      />
      <DocumentLibrary
        key={q}
        initialSearch={q}
        selectedId={documentId}
        onSelectedIdChange={(id) => navigate(id ? `/documents/${id}` : '/documents')}
      />
    </>
  )
}
