import uuid
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

from app.api.deps import Client, DbSession, require_permission
from app.core.config import get_settings
from app.models.document import DocumentStatus, FileType
from app.models.user import User
from app.permissions.codes import PermissionCode as P
from app.schemas.common import Page, PageParams, page_params
from app.schemas.documents import (
    CategoryOut,
    DocumentMetadata,
    DocumentOut,
    DocumentUpdate,
    UploadConfig,
)
from app.services.documents import service as documents
from app.services.documents.validation import receive_upload
from app.storage import StorageService, get_storage

router = APIRouter(prefix="/documents", tags=["documents"])

CanRead = Annotated[User, Depends(require_permission(P.DOCUMENTS_READ))]
CanUpload = Annotated[User, Depends(require_permission(P.DOCUMENTS_UPLOAD))]
Storage = Annotated[StorageService, Depends(get_storage)]


def upload_config() -> UploadConfig:
    # Phase 09 lets admins override these in the DB (admin settings).
    settings = get_settings()
    return UploadConfig(
        max_upload_bytes=settings.max_upload_mb * 1024 * 1024,
        allowed_types=[t for t in settings.allowed_file_type_list if t in FileType],
    )


# Static paths first: otherwise "/categories" would be parsed as a {document_id}.


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(_: CanRead, db: DbSession) -> list[CategoryOut]:
    return [CategoryOut(code=c.code, name=c.name) for c in documents.list_categories(db)]


@router.get("/upload-config", response_model=UploadConfig)
def get_upload_config(_: CanRead) -> UploadConfig:
    return upload_config()


@router.get("", response_model=Page[DocumentOut])
def list_documents(
    user: CanRead,
    db: DbSession,
    params: Annotated[PageParams, Depends(page_params)],
    q: Annotated[str | None, Query(max_length=100)] = None,
    project_id: uuid.UUID | None = None,
    category: Annotated[str | None, Query(max_length=32)] = None,
    file_type: Annotated[FileType | None, Query(alias="type")] = None,
    status_: Annotated[DocumentStatus | None, Query(alias="status")] = None,
) -> Page[DocumentOut]:
    items, total = documents.list_documents(
        db,
        user,
        params,
        q=q,
        project_id=project_id,
        category=category,
        file_type=file_type,
        status=status_,
    )
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def upload_document(
    actor: CanUpload,
    db: DbSession,
    storage: Storage,
    client: Client,
    file: Annotated[UploadFile, File()],
    project_id: Annotated[str, Form()],
    code: Annotated[str, Form()],
    title: Annotated[str, Form()],
    description: Annotated[str | None, Form()] = None,
    category: Annotated[str | None, Form()] = None,
    revision: Annotated[str | None, Form()] = None,
    status_: Annotated[str, Form(alias="status")] = DocumentStatus.DRAFT,
) -> DocumentOut:
    # Validate the cheap metadata before touching the file.
    try:
        meta = DocumentMetadata.model_validate(
            {
                "project_id": project_id,
                "code": code,
                "title": title,
                "description": description,
                "category": category,
                "revision": revision,
                "status": status_,
            }
        )
    except ValidationError as exc:
        raise RequestValidationError(
            [{**e, "loc": ("body", *e["loc"])} for e in exc.errors()]
        ) from exc

    config = upload_config()
    validated = receive_upload(
        file.file,
        file.filename,
        max_bytes=config.max_upload_bytes,
        allowed_types=config.allowed_types,
    )
    try:
        document = documents.upload_document(db, storage, actor, meta, validated, ip=client.ip)
    finally:
        validated.close()
    return documents.to_out(db, actor, document)


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: uuid.UUID, user: CanRead, db: DbSession) -> DocumentOut:
    return documents.to_out(db, user, documents.get_visible_document(db, user, document_id))


@router.patch("/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: uuid.UUID, body: DocumentUpdate, actor: CanRead, db: DbSession, client: Client
) -> DocumentOut:
    document = documents.update_document(db, actor, document_id, body, ip=client.ip)
    return documents.to_out(db, actor, document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID, actor: CanRead, db: DbSession, storage: Storage, client: Client
) -> Response:
    documents.delete_document(db, storage, actor, document_id, ip=client.ip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _content_disposition(filename: str, inline: bool) -> str:
    ascii_fallback = (
        filename.encode("ascii", "replace").decode().replace('"', "'").replace("?", "_")
    )
    kind = "inline" if inline else "attachment"
    return f"{kind}; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(filename)}"


@router.get("/{document_id}/download")
def download_document(
    document_id: uuid.UUID,
    user: CanRead,
    db: DbSession,
    storage: Storage,
    client: Client,
    inline: bool = False,
) -> StreamingResponse:
    document, stream = documents.open_download(db, storage, user, document_id, ip=client.ip)
    # Only formats browsers render safely are allowed inline; DOCX always downloads.
    show_inline = inline and document.file_type in (FileType.PDF, FileType.TXT)
    return StreamingResponse(
        stream,
        media_type=document.mime_type,
        headers={
            "Content-Length": str(document.size_bytes),
            "Content-Disposition": _content_disposition(document.original_filename, show_inline),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )
