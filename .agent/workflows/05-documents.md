# Phase 05: Documents (4–5 days)

**Goal:** A usable internal engineering document library, protected by project membership. Plan §13–16 and §39.

## Prerequisites
Phase 04 done. The access rule has to work before this phase starts.

## Backend
- [ ] `storage/base.py` `StorageService` protocol: `upload(stream, key) -> StoredFile`, `download(key) -> stream`, `delete(key)`, `exists(key)`.
- [ ] `storage/local.py` `LocalStorage` writes to `STORAGE_ROOT/documents/<uuid>`. Inject it through a dependency so it can be swapped for MinIO later.
- [ ] Models: `DocumentCategory` (seed: Requirements, Design, Test, Standards, Reports, Procedures, Other). `Document` (id, code e.g. `EPS-SRS-001`, title, description, project_id, category_id, file_type, mime_type, size_bytes, storage_key, original_filename, revision optional, status enum [draft, pending_review, approved, obsolete], uploaded_by, timestamps).
  - **`UNIQUE(project_id, code)` (D14)**: a duplicate code in the same project → 409 `DOCUMENT_CODE_EXISTS` ("A document with code EPS-SRS-001 already exists in NEXSAT-1"). No revisions in the POC.
  - **Status is a plain label (D7)**: anyone who can edit the document (uploader, project lead, admin) may set any value. No approval workflow.
  - Documents are **hard-deleted** with their file (D16). Documents of a soft-deleted project are hidden, not deleted. Create the `document_permissions` table but leave it unused for now (plan §33).
- [ ] Migration.
- [ ] Validation: extension in `ALLOWED_FILE_TYPES`, MIME/magic-byte sniff, size ≤ `MAX_UPLOAD_MB` (stream it and abort early), sanitized filename. Reject cleanly with a clear error code.
- [ ] `services/documents`: upload (multipart: file + metadata), list (filter by `visible_project_ids` in SQL), get, update metadata, download/view stream, delete (DB row plus file, in a transaction-safe order).
- [ ] Routes:
  ```text
  GET    /api/v1/documents?q=&project_id=&category=&type=&status=&page=   documents:read
  POST   /api/v1/documents            (multipart)                         documents:upload + project role ≠ viewer
  GET    /api/v1/documents/{id}                                           documents:read + access
  PATCH  /api/v1/documents/{id}                                           uploader/lead/admin
  GET    /api/v1/documents/{id}/download?inline=true|false                documents:read + access
  DELETE /api/v1/documents/{id}                                           own → documents:delete; others → delete_any
  GET    /api/v1/document-categories
  ```
- [ ] Search is a simple `ILIKE` on code, title, and description. **No** content extraction or semantic search.
- [ ] Audit: `document.upload`, `document.download`, `document.delete`, `document.update`.
- [ ] Extend the demo seed (D12) with about 10 placeholder documents per project, generated as small fake PDF/DOCX/TXT files with realistic codes, categories, and statuses (e.g. EPS-SRS-001 Requirements, Approved).

## Frontend: `features/documents`
- [ ] `pages/DocumentsPage.tsx`: PageHeader "Engineering Library" with subtitle, optional hero. SearchBar plus filters (project via `ProjectSelect`, category, type, status). Table rows show FileTypeIcon, code with title, project tag, revision, status badge, uploader, and updated date. Pagination. Row click opens a detail Drawer.
- [ ] `components/UploadDocumentModal.tsx`: drag-and-drop, client-side type and size pre-check, metadata form (title, code, description, project, category, status), upload progress, success/error toast.
- [ ] `components/DocumentDrawer.tsx`: metadata, View (PDF inline in a new tab), Download, Edit, Delete (confirm modal).
- [ ] `index.ts` exports `ProjectDocumentsTable` (for the Project Detail tab) and `RecentDocuments` (for the dashboard).
- [ ] `manifest.ts`: `/documents`, `/documents/:id`, nav "Documents".
- [ ] Wire the Documents tab in `features/projects` ProjectDetailPage.

## Verification
- Upload PDF, DOCX, and TXT successfully. An `.exe`, a renamed binary, and an oversize file are all rejected with clear messages.
- A user in NEXSAT-1 but not SAR can't list, view, download, or delete SAR docs (404).
- A Viewer can view and download but can't upload or delete.
- Deleting removes both the row and the file.
- Uploading a second EPS-SRS-001 into NEXSAT-1 is rejected with a clear message. The same code in SAR is allowed.
- Arabic titles and descriptions are stored, searched, and displayed correctly.
- Tests cover all of the above, plus that each action writes an audit row.

## Deliverable
Internal engineering document library.

## Out of scope
Text extraction, chunking, embeddings, versioned revisions workflow, MinIO.
