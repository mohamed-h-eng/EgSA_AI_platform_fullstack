"""Audit logging (ADR-09): services call `audit.log(...)` inside their own transaction."""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.admin import AuditLogOut
from app.schemas.common import PageParams
from app.schemas.projects import UserSummary


class AuditAction(StrEnum):
    AUTH_LOGIN = "auth.login"
    AUTH_LOGIN_FAILED = "auth.login_failed"
    AUTH_LOGOUT = "auth.logout"
    AUTH_PASSWORD_CHANGE = "auth.password_change"
    AUTH_REFRESH_REUSE = "auth.refresh_reuse_detected"

    USER_CREATE = "user.create"
    USER_UPDATE = "user.update"
    USER_DISABLE = "user.disable"
    USER_ENABLE = "user.enable"
    USER_ROLE_CHANGE = "user.role_change"
    USER_PASSWORD_RESET = "user.password_reset"

    PROJECT_CREATE = "project.create"
    PROJECT_UPDATE = "project.update"
    PROJECT_DELETE = "project.delete"
    PROJECT_MEMBER_ADD = "project.member_add"
    PROJECT_MEMBER_ROLE_CHANGE = "project.member_role_change"
    PROJECT_MEMBER_REMOVE = "project.member_remove"

    DOCUMENT_UPLOAD = "document.upload"
    DOCUMENT_UPDATE = "document.update"
    DOCUMENT_DOWNLOAD = "document.download"
    DOCUMENT_DELETE = "document.delete"

    PROFILE_UPDATE = "profile.update"

    AI_REQUEST = "ai.request"
    SETTINGS_AI_UPDATE = "settings.ai_update"
    SETTINGS_UPDATE = "settings.update"


def log(
    db: Session,
    action: AuditAction | str,
    *,
    actor_id: uuid.UUID | None = None,
    target_type: str | None = None,
    target_id: uuid.UUID | str | None = None,
    meta: dict[str, Any] | None = None,
    ip: str | None = None,
) -> AuditLog:
    """Add an audit row to the session. The caller commits. Never put secrets in `meta`."""
    entry = AuditLog(
        actor_id=actor_id,
        action=str(action),
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        meta=meta or {},
        ip=ip,
    )
    db.add(entry)
    return entry


def list_logs(
    db: Session,
    params: PageParams,
    *,
    actor: str | None = None,
    action: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> tuple[list[AuditLogOut], int]:
    """Newest first. `action` matches exactly or as a prefix ("document" → "document.*");
    `actor` matches the actor's email or name."""
    query = select(AuditLog, User).outerjoin(User, User.id == AuditLog.actor_id)
    if actor and actor.strip():
        term = actor.strip()
        query = query.where(
            or_(
                User.email.icontains(term, autoescape=True),
                User.full_name.icontains(term, autoescape=True),
            )
        )
    if action and action.strip():
        term = action.strip()
        query = query.where(
            or_(AuditLog.action == term, AuditLog.action.startswith(f"{term}.", autoescape=True))
        )
    if date_from:
        query = query.where(AuditLog.created_at >= date_from)
    if date_to:
        query = query.where(AuditLog.created_at < date_to)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.execute(
        query.order_by(AuditLog.created_at.desc(), AuditLog.id)
        .offset(params.offset)
        .limit(params.page_size)
    ).all()
    return [
        AuditLogOut(
            id=entry.id,
            action=entry.action,
            actor=UserSummary(id=user.id, full_name=user.full_name, email=user.email)
            if user
            else None,
            target_type=entry.target_type,
            target_id=entry.target_id,
            meta=entry.meta or {},
            ip=entry.ip,
            created_at=entry.created_at,
        )
        for entry, user in rows
    ], total
