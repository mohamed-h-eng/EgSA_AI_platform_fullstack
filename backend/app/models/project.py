import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin, utcnow
from app.models.user import User


class ProjectStatus(StrEnum):
    PLANNING = "planning"
    IN_DEVELOPMENT = "in_development"
    TESTING = "testing"
    OPERATIONAL = "operational"
    ARCHIVED = "archived"


class ProjectRole(StrEnum):
    """Role *within* a project. Effective rights = global permission AND this role (ADR-06)."""

    LEAD = "lead"
    ENGINEER = "engineer"
    VIEWER = "viewer"


class Project(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "projects"

    # Human code such as NEXSAT-1. Stays reserved after soft delete (D16).
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    subsystem: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(32), default=ProjectStatus.PLANNING)
    image_key: Mapped[str | None] = mapped_column(String(255))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )

    created_by: Mapped[User | None] = relationship(lazy="joined")
    members: Mapped[list["ProjectMember"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", lazy="selectin"
    )


class ProjectMember(Base):
    __tablename__ = "project_members"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    project_role: Mapped[str] = mapped_column(String(16), default=ProjectRole.ENGINEER)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project: Mapped[Project] = relationship(back_populates="members")
    user: Mapped[User] = relationship(lazy="joined")
