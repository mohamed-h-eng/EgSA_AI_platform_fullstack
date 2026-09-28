import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.models.document import FileType
from app.schemas.chat import ConversationOut
from app.schemas.documents import DocumentOut
from app.schemas.projects import ProjectOut, UserSummary

# ── Admin settings ────────────────────────────────────────

MAX_UPLOAD_MB_LIMIT = 500


class UploadSettingsOut(BaseModel):
    max_upload_mb: int
    allowed_file_types: list[FileType]
    # What the environment would give if the admin override were cleared.
    env_max_upload_mb: int
    env_allowed_file_types: list[FileType]
    overridden: bool
    updated_at: datetime | None
    updated_by: UserSummary | None


class UploadSettingsUpdate(BaseModel):
    """Both fields required; send `reset: true` to go back to the environment defaults."""

    max_upload_mb: int = Field(ge=1, le=MAX_UPLOAD_MB_LIMIT)
    allowed_file_types: list[FileType] = Field(min_length=1)
    reset: bool = False

    @field_validator("allowed_file_types")
    @classmethod
    def _dedupe(cls, value: list[FileType]) -> list[FileType]:
        return sorted(set(value))


# ── Audit log ─────────────────────────────────────────────


class AuditLogOut(BaseModel):
    id: uuid.UUID
    action: str
    actor: UserSummary | None
    target_type: str | None
    target_id: str | None
    meta: dict[str, Any]
    ip: str | None
    created_at: datetime


# ── Profile ───────────────────────────────────────────────


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=200)
    job_title: str | None = Field(default=None, max_length=200)

    @field_validator("full_name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = " ".join(value.split())
        if not value:
            raise ValueError("Name is required.")
        return value


# ── Dashboard ─────────────────────────────────────────────


class DashboardCounts(BaseModel):
    projects: int
    documents: int
    conversations: int
    ai_requests: int


class AIUserUsage(BaseModel):
    user: UserSummary | None
    requests: int
    failed: int
    tokens: int


class AdminStats(BaseModel):
    active_users: int
    total_users: int
    total_projects: int
    total_documents: int
    ai_requests_7d: int
    failed_ai_requests_7d: int
    tokens_7d: int
    ai_usage_7d: list[AIUserUsage]


class DashboardSummary(BaseModel):
    counts: DashboardCounts
    recent_conversations: list[ConversationOut]
    recent_documents: list[DocumentOut]
    my_projects: list[ProjectOut]
    admin: AdminStats | None = None
