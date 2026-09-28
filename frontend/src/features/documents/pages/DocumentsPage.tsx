import { useNavigate, useParams } from 'react-router'

import { PageHeader } from '@shared/layout/PageHeader'

import { DocumentLibrary } from '../components/DocumentLibrary'

/** Engineering Library (design.md §31). /documents/:documentId opens that document's drawer. */
export function DocumentsPage() {
  const { documentId = null } = useParams()
  const navigate = useNavigate()

  return (
    <>
      <PageHeader
        title="Engineering Library"
        subtitle="Access engineering documents, standards, and knowledge across EgSA's space projects."
      />
      <DocumentLibrary
        selectedId={documentId}
        onSelectedIdChange={(id) => navigate(id ? `/documents/${id}` : '/documents')}
      />
    </>
  )
}
