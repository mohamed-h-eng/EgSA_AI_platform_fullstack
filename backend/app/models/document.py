import uuid
from enum import StrEnum

from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.project import Project
from app.models.user import User


class DocumentStatus(StrEnum):
    """A metadata label only: no approval workflow in the POC (decision D7)."""

    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    OBSOLETE = "obsolete"


class FileType(StrEnum):
    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"


class DocumentCategory(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "document_categories"

    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Document(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "documents"
    # Decision D14: a document code is unique within its project.
    __table_args__ = (UniqueConstraint("project_id", "code", name="uq_documents_project_id_code"),)

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("document_categories.id", ondelete="SET NULL")
    )
    code: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    revision: Mapped[str | None] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(32), default=DocumentStatus.DRAFT)

    file_type: Mapped[str] = mapped_column(String(8))
    mime_type: Mapped[str] = mapped_column(String(127))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(String(64))
    storage_key: Mapped[str] = mapped_column(String(128), unique=True)
    original_filename: Mapped[str] = mapped_column(String(255))

    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )

    project: Mapped[Project] = relationship(lazy="joined")
    category: Mapped[DocumentCategory | None] = relationship(lazy="joined")
    uploaded_by: Mapped[User | None] = relationship(lazy="joined")


class DocumentPermission(Base):
    """Per-document grants. Created now per plan §33 but UNUSED in the POC: access comes from
    project membership. Kept so later RAG/sharing work doesn't need a schema redesign."""

    __tablename__ = "document_permissions"

    document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    permission: Mapped[str] = mapped_column(String(32), primary_key=True)
