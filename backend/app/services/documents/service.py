"""Engineering document library (plan §13–16, workflow 05)."""

import logging
import uuid
from collections.abc import Iterator

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.models.document import Document, DocumentCategory, DocumentStatus, FileType
from app.models.project import Project, ProjectRole
from app.models.user import User
from app.permissions import policies
from app.schemas.common import PageParams
from app.schemas.documents import (
    CategoryOut,
    DocumentAbilities,
    DocumentMetadata,
    DocumentOut,
    DocumentUpdate,
    ProjectRef,
)
from app.schemas.projects import UserSummary
from app.services import audit
from app.services.audit import AuditAction
from app.services.documents.validation import ValidatedFile
from app.storage import StorageError, StorageService

log = logging.getLogger(__name__)

# ── Categories ────────────────────────────────────────────

DEFAULT_CATEGORIES = (
    ("requirements", "Requirements"),
    ("design", "Design"),
    ("test", "Test"),
    ("standards", "Standards"),
    ("reports", "Reports"),
    ("procedures", "Procedures"),
    ("other", "Other"),
)


def seed_categories(db: Session) -> None:
    existing = {c.code for c in db.scalars(select(DocumentCategory))}
    for order, (code, name) in enumerate(DEFAULT_CATEGORIES):
        if code not in existing:
            db.add(DocumentCategory(code=code, name=name, sort_order=order))
    db.flush()


def list_categories(db: Session) -> list[DocumentCategory]:
    return list(db.scalars(select(DocumentCategory).order_by(DocumentCategory.sort_order)))


def _category(db: Session, code: str | None) -> DocumentCategory | None:
    if code is None:
        return None
    category = db.scalar(select(DocumentCategory).where(DocumentCategory.code == code))
    if category is None:
        raise AppError(f"Unknown category '{code}'.", code="UNKNOWN_CATEGORY")
    return category


# ── Output ────────────────────────────────────────────────


def _to_out(document: Document, user: User, role: ProjectRole | None) -> DocumentOut:
    uploader = document.uploaded_by
    return DocumentOut(
        id=document.id,
        code=document.code,
        title=document.title,
        description=document.description,
        revision=document.revision,
        status=DocumentStatus(document.status),
        category=(
            CategoryOut(code=document.category.code, name=document.category.name)
            if document.category
            else None
        ),
        project=ProjectRef(
            id=document.project.id, code=document.project.code, name=document.project.name
        ),
        file_type=FileType(document.file_type),
        size_bytes=document.size_bytes,
        original_filename=document.original_filename,
        uploaded_by=(
            UserSummary(id=uploader.id, full_name=uploader.full_name, email=uploader.email)
            if uploader
            else None
        ),
        created_at=document.created_at,
        updated_at=document.updated_at,
        abilities=DocumentAbilities(
            can_edit=policies.can_edit_document(user, role, document.uploaded_by_id),
            can_delete=policies.can_delete_document(user, role, document.uploaded_by_id),
        ),
    )


def to_out(db: Session, user: User, document: Document) -> DocumentOut:
    return _to_out(document, user, policies.project_role(db, user, document.project_id))


# ── Queries ───────────────────────────────────────────────


def _not_found() -> NotFoundError:
    return NotFoundError("Document not found.", code="DOCUMENT_NOT_FOUND")


def get_visible_document(db: Session, user: User, document_id: uuid.UUID) -> Document:
    """The document if its project is visible to the user; otherwise 404 (plan §16)."""
    document = db.get(Document, document_id)
    if document is None or not policies.can_access_project(db, user, document.project):
        raise _not_found()
    return document


def list_documents(
    db: Session,
    user: User,
    params: PageParams,
    *,
    q: str | None = None,
    project_id: uuid.UUID | None = None,
    category: str | None = None,
    file_type: FileType | None = None,
    status: DocumentStatus | None = None,
) -> tuple[list[DocumentOut], int]:
    # Filter by visible projects IN SQL: never load documents the user can't see.
    query = select(Document).where(Document.project_id.in_(policies.visible_project_ids(user)))
    if q and q.strip():
        term = q.strip()
        query = query.where(
            or_(
                Document.code.icontains(term, autoescape=True),
                Document.title.icontains(term, autoescape=True),
                Document.description.icontains(term, autoescape=True),
            )
        )
    if project_id:
        query = query.where(Document.project_id == project_id)
    if category:
        query = query.join(DocumentCategory).where(DocumentCategory.code == category)
    if file_type:
        query = query.where(Document.file_type == file_type)
    if status:
        query = query.where(Document.status == status)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    documents = list(
        db.scalars(
            query.order_by(Document.updated_at.desc(), Document.code)
            .offset(params.offset)
            .limit(params.page_size)
        ).unique()
    )
    roles = policies.project_roles_for(db, user, list({d.project_id for d in documents}))
    return [_to_out(d, user, roles.get(d.project_id)) for d in documents], total


def document_counts(db: Session, project_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    rows = db.execute(
        select(Document.project_id, func.count())
        .where(Document.project_id.in_(project_ids))
        .group_by(Document.project_id)
    )
    return {project_id: count for project_id, count in rows}


# ── Commands ──────────────────────────────────────────────


def _ensure_code_free(
    db: Session, project: Project, code: str, *, excluding: uuid.UUID | None = None
) -> None:
    query = select(Document.id).where(Document.project_id == project.id, Document.code == code)
    if excluding is not None:
        query = query.where(Document.id != excluding)
    if db.scalar(query) is not None:
        raise ConflictError(
            f"A document with code {code} already exists in {project.code}.",
            code="DOCUMENT_CODE_EXISTS",
        )


def upload_document(
    db: Session,
    storage: StorageService,
    actor: User,
    meta: DocumentMetadata,
    upload: ValidatedFile,
    *,
    ip: str | None,
) -> Document:
    project = db.get(Project, meta.project_id)
    if project is None or not policies.can_access_project(db, actor, project):
        raise NotFoundError("Project not found.", code="PROJECT_NOT_FOUND")
    if not policies.can_upload_to_project(db, actor, project):
        raise ForbiddenError("You can't upload documents to this project (read-only access).")
    _ensure_code_free(db, project, meta.code)
    category = _category(db, meta.category)

    storage_key = uuid.uuid4().hex  # never the user's filename (ADR-08)
    storage.save(storage_key, upload.content)
    try:
        document = Document(
            project_id=project.id,
            category_id=category.id if category else None,
            code=meta.code,
            title=meta.title,
            description=meta.description,
            revision=meta.revision,
            status=meta.status,
            file_type=upload.file_type,
            mime_type=upload.mime_type,
            size_bytes=upload.size_bytes,
            sha256=upload.sha256,
            storage_key=storage_key,
            original_filename=upload.filename,
            uploaded_by_id=actor.id,
        )
        db.add(document)
        db.flush()
        audit.log(
            db,
            AuditAction.DOCUMENT_UPLOAD,
            actor_id=actor.id,
            target_type="document",
            target_id=document.id,
            meta={
                "project": project.code,
                "code": document.code,
                "file_type": document.file_type,
                "size_bytes": document.size_bytes,
            },
            ip=ip,
        )
        db.commit()
    except BaseException:
        db.rollback()
        storage.delete(storage_key)  # don't leave an orphan file behind
        raise
    db.refresh(document)
    return document


def update_document(
    db: Session, actor: User, document_id: uuid.UUID, data: DocumentUpdate, *, ip: str | None
) -> Document:
    document = get_visible_document(db, actor, document_id)
    role = policies.project_role(db, actor, document.project_id)
    if not policies.can_edit_document(actor, role, document.uploaded_by_id):
        raise ForbiddenError("Only the uploader, the project lead or an administrator can edit.")

    changed: list[str] = []
    fields = data.model_fields_set
    if "code" in fields and data.code and data.code != document.code:
        _ensure_code_free(db, document.project, data.code, excluding=document.id)
        document.code = data.code
        changed.append("code")
    if "title" in fields and data.title and data.title != document.title:
        document.title = data.title
        changed.append("title")
    if "status" in fields and data.status and data.status != document.status:
        document.status = data.status
        changed.append("status")
    for field in ("description", "revision"):
        if field in fields and getattr(data, field) != getattr(document, field):
            setattr(document, field, getattr(data, field))
            changed.append(field)
    if "category" in fields:
        category = _category(db, data.category)
        if (category.id if category else None) != document.category_id:
            document.category = category
            changed.append("category")

    if changed:
        audit.log(
            db,
            AuditAction.DOCUMENT_UPDATE,
            actor_id=actor.id,
            target_type="document",
            target_id=document.id,
            meta={"changed": changed},
            ip=ip,
        )
        db.commit()
    return document


def delete_document(
    db: Session, storage: StorageService, actor: User, document_id: uuid.UUID, *, ip: str | None
) -> None:
    """Hard delete (D16): the DB row first, then the file. If removing the file fails we
    only leave an orphan file (logged), never a row pointing at a missing file."""
    document = get_visible_document(db, actor, document_id)
    role = policies.project_role(db, actor, document.project_id)
    if not policies.can_delete_document(actor, role, document.uploaded_by_id):
        raise ForbiddenError("You can't delete this document.")

    storage_key = document.storage_key
    audit.log(
        db,
        AuditAction.DOCUMENT_DELETE,
        actor_id=actor.id,
        target_type="document",
        target_id=document.id,
        meta={"project": document.project.code, "code": document.code},
        ip=ip,
    )
    db.delete(document)
    db.commit()
    try:
        storage.delete(storage_key)
    except OSError:
        log.exception(
            "Document %s deleted but its file %s could not be removed", document_id, storage_key
        )


def open_download(
    db: Session, storage: StorageService, actor: User, document_id: uuid.UUID, *, ip: str | None
) -> tuple[Document, Iterator[bytes]]:
    document = get_visible_document(db, actor, document_id)
    try:
        stream = storage.open_stream(document.storage_key)
    except StorageError as exc:
        log.error("Stored file missing for document %s: %s", document.id, exc)
        raise NotFoundError(
            "The file for this document is missing. Contact an administrator.",
            code="DOCUMENT_FILE_MISSING",
        ) from exc
    audit.log(
        db,
        AuditAction.DOCUMENT_DOWNLOAD,
        actor_id=actor.id,
        target_type="document",
        target_id=document.id,
        meta={"project": document.project.code, "code": document.code},
        ip=ip,
    )
    db.commit()
    return document, stream
