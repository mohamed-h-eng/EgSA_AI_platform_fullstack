import re
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.project import ProjectRole, ProjectStatus

_CODE_RE = re.compile(r"^[A-Z0-9][A-Z0-9-]{1,31}$")


def _normalize_code(value: str) -> str:
    value = value.strip().upper()
    if not _CODE_RE.match(value):
        raise ValueError(
            "Code must be 2–32 characters: letters, digits and hyphens (e.g. NEXSAT-1)."
        )
    return value


def _clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


class UserSummary(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str


class ProjectAbilities(BaseModel):
    """What the *caller* may do with this project, computed server-side."""

    can_edit: bool
    can_manage_members: bool
    can_delete: bool


class ProjectOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    subsystem: str | None
    status: ProjectStatus
    member_count: int
    document_count: int
    my_role: ProjectRole | None
    created_by: UserSummary | None
    created_at: datetime
    updated_at: datetime


class ProjectDetail(ProjectOut):
    abilities: ProjectAbilities


class ProjectCreate(BaseModel):
    code: str = Field(max_length=32)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    subsystem: str | None = Field(default=None, max_length=100)
    status: ProjectStatus = ProjectStatus.PLANNING

    _code = field_validator("code")(_normalize_code)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Name is required.")
        return value

    _texts = field_validator("description", "subsystem")(_clean_text)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    subsystem: str | None = Field(default=None, max_length=100)
    status: ProjectStatus | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = " ".join(value.split())
        if not value:
            raise ValueError("Name is required.")
        return value

    _texts = field_validator("description", "subsystem")(_clean_text)


class MemberOut(BaseModel):
    user: UserSummary
    user_is_active: bool
    project_role: ProjectRole
    added_at: datetime


class MemberAdd(BaseModel):
    user_id: uuid.UUID
    project_role: ProjectRole = ProjectRole.ENGINEER


class MemberUpdate(BaseModel):
    project_role: ProjectRole


class UserProjectMembership(BaseModel):
    """A project a given user belongs to (for the admin user drawer)."""

    project_id: uuid.UUID
    code: str
    name: str
    status: ProjectStatus
    project_role: ProjectRole
