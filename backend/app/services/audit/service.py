"""Audit logging (ADR-09): services call `audit.log(...)` inside their own transaction."""

import uuid
from enum import StrEnum
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


class AuditAction(StrEnum):
    AUTH_LOGIN = "auth.login"
    AUTH_LOGIN_FAILED = "auth.login_failed"
    AUTH_LOGOUT = "auth.logout"
    AUTH_PASSWORD_CHANGE = "auth.password_change"
    AUTH_REFRESH_REUSE = "auth.refresh_reuse_detected"


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
