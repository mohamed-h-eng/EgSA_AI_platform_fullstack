import re
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.document import DocumentStatus, FileType
from app.schemas.projects import UserSummary

_CODE_RE = re.compile(r"^[A-Z0-9][A-Z0-9._-]{0,63}$")


def normalize_document_code(value: str) -> str:
    value = value.strip().upper()
    if not _CODE_RE.match(value):
        raise ValueError(
            "Document code must be 1–64 characters: letters, digits, dots, hyphens or "
            "underscores (e.g. EPS-SRS-001)."
        )
    return value


def clean_title(value: str) -> str:
    value = " ".join(value.split())
    if not value:
        raise ValueError("Title is required.")
    return value


def clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


class CategoryOut(BaseModel):
    code: str
    name: str


class ProjectRef(BaseModel):
    id: uuid.UUID
    code: str
    name: str


class DocumentAbilities(BaseModel):
    can_edit: bool
    can_delete: bool


class DocumentOut(BaseModel):
    id: uuid.UUID
    code: str
    title: str
    description: str | None
    revision: str | None
    status: DocumentStatus
    category: CategoryOut | None
    project: ProjectRef
    file_type: FileType
    size_bytes: int
    original_filename: str
    uploaded_by: UserSummary | None
    created_at: datetime
    updated_at: datetime
    abilities: DocumentAbilities


class DocumentMetadata(BaseModel):
    """Metadata sent with an upload (as multipart form fields)."""

    project_id: uuid.UUID
    code: str = Field(max_length=64)
    title: str = Field(max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    category: str | None = Field(default=None, max_length=32)
    revision: str | None = Field(default=None, max_length=16)
    status: DocumentStatus = DocumentStatus.DRAFT

    _code = field_validator("code")(normalize_document_code)
    _title = field_validator("title")(clean_title)
    _optional = field_validator("description", "category", "revision")(clean_optional)


class DocumentUpdate(BaseModel):
    code: str | None = Field(default=None, max_length=64)
    title: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    category: str | None = Field(default=None, max_length=32)
    revision: str | None = Field(default=None, max_length=16)
    status: DocumentStatus | None = None

    @field_validator("code")
    @classmethod
    def _code(cls, value: str | None) -> str | None:
        return None if value is None else normalize_document_code(value)

    @field_validator("title")
    @classmethod
    def _title(cls, value: str | None) -> str | None:
        return None if value is None else clean_title(value)

    _optional = field_validator("description", "category", "revision")(clean_optional)


class UploadConfig(BaseModel):
    max_upload_bytes: int
    allowed_types: list[str]
