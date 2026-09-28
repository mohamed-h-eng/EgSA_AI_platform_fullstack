"""Login, session (refresh-token) lifecycle and password changes."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError, ForbiddenError, TooManyRequestsError, UnauthorizedError
from app.core.rate_limit import SlidingWindowLimiter
from app.core.security import (
    as_utc,
    create_access_token,
    hash_password,
    hash_token,
    new_refresh_token,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.services import audit
from app.services.audit import AuditAction
from app.services.auth.providers import get_auth_provider, normalize_email

_settings = get_settings()
login_limiter = SlidingWindowLimiter(_settings.login_max_attempts, _settings.login_window_seconds)


@dataclass
class ClientInfo:
    ip: str | None
    user_agent: str | None


@dataclass
class AuthSession:
    user: User
    access_token: str
    expires_in: int
    refresh_token: str


def _issue(db: Session, user: User, client: ClientInfo) -> AuthSession:
    raw = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw),
            expires_at=datetime.now(UTC) + timedelta(hours=get_settings().refresh_token_ttl_hours),
            ip=client.ip,
            user_agent=(client.user_agent or "")[:255] or None,
        )
    )
    access, expires_in = create_access_token(user.id)
    return AuthSession(user=user, access_token=access, expires_in=expires_in, refresh_token=raw)


def _session_expired() -> UnauthorizedError:
    return UnauthorizedError(
        "Your session has expired. Please sign in again.", code="REFRESH_TOKEN_INVALID"
    )


class RevokeReason:
    ROTATED = "rotated"
    LOGOUT = "logout"
    PASSWORD_CHANGE = "password_change"
    REUSE_DETECTED = "reuse_detected"
    USER_DISABLED = "user_disabled"
    PASSWORD_RESET = "password_reset"


def _revoke(record: RefreshToken, reason: str) -> None:
    record.revoked_at = datetime.now(UTC)
    record.revoked_reason = reason


def revoke_all_sessions(db: Session, user_id: uuid.UUID, reason: str) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC), revoked_reason=reason)
    )


def login(db: Session, email: str, password: str, client: ClientInfo) -> AuthSession:
    email = normalize_email(email)
    limiter_key = f"{client.ip}:{email}"
    if login_limiter.is_blocked(limiter_key):
        raise TooManyRequestsError(
            "Too many failed login attempts. Try again in a few minutes.",
            code="TOO_MANY_ATTEMPTS",
        )

    user = get_auth_provider().verify(db, email, password)
    if user is None:
        login_limiter.hit(limiter_key)
        audit.log(db, AuditAction.AUTH_LOGIN_FAILED, meta={"email": email}, ip=client.ip)
        db.commit()
        raise UnauthorizedError("Invalid email or password.", code="INVALID_CREDENTIALS")

    if not user.is_active:
        audit.log(
            db,
            AuditAction.AUTH_LOGIN_FAILED,
            actor_id=user.id,
            meta={"email": email, "reason": "disabled"},
            ip=client.ip,
        )
        db.commit()
        raise ForbiddenError(
            "Your account is disabled. Contact the platform administrator.",
            code="ACCOUNT_DISABLED",
        )

    login_limiter.reset(limiter_key)
    user.last_login_at = datetime.now(UTC)
    session = _issue(db, user, client)
    audit.log(db, AuditAction.AUTH_LOGIN, actor_id=user.id, ip=client.ip)
    db.commit()
    return session


def refresh(db: Session, raw_token: str | None, client: ClientInfo) -> AuthSession:
    """Rotate the refresh token. Presenting a token that was already rotated revokes every
    session of that user (the token was probably stolen)."""
    if not raw_token:
        raise _session_expired()

    record = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token)))
    if record is None:
        raise _session_expired()

    if record.revoked_at is not None:
        rotated_long_ago = record.revoked_at is not None and as_utc(
            record.revoked_at
        ) < datetime.now(UTC) - timedelta(seconds=get_settings().refresh_reuse_grace_seconds)
        if record.revoked_reason == RevokeReason.ROTATED and rotated_long_ago:
            # An already-rotated token came back: someone else holds a copy of it.
            revoke_all_sessions(db, record.user_id, RevokeReason.REUSE_DETECTED)
            audit.log(db, AuditAction.AUTH_REFRESH_REUSE, actor_id=record.user_id, ip=client.ip)
            db.commit()
        raise _session_expired()

    if as_utc(record.expires_at) <= datetime.now(UTC):
        raise _session_expired()

    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        raise _session_expired()

    _revoke(record, RevokeReason.ROTATED)
    session = _issue(db, user, client)
    db.commit()
    return session


def logout(db: Session, raw_token: str | None, client: ClientInfo) -> None:
    if not raw_token:
        return
    record = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token)))
    if record is None:
        return
    if record.revoked_at is None:
        _revoke(record, RevokeReason.LOGOUT)
    audit.log(db, AuditAction.AUTH_LOGOUT, actor_id=record.user_id, ip=client.ip)
    db.commit()


def change_password(
    db: Session, user: User, current_password: str, new_password: str, client: ClientInfo
) -> AuthSession:
    """Change the password, end every other session and return a fresh one."""
    if not verify_password(current_password, user.password_hash):
        raise AppError("Current password is incorrect.", code="INVALID_CURRENT_PASSWORD")
    if len(new_password) < get_settings().password_min_length:
        raise AppError(
            f"Password must be at least {get_settings().password_min_length} characters.",
            code="PASSWORD_TOO_SHORT",
        )
    if verify_password(new_password, user.password_hash):
        raise AppError(
            "New password must be different from the current one.", code="PASSWORD_UNCHANGED"
        )

    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    user.password_changed_at = datetime.now(UTC)
    revoke_all_sessions(db, user.id, RevokeReason.PASSWORD_CHANGE)
    session = _issue(db, user, client)
    audit.log(db, AuditAction.AUTH_PASSWORD_CHANGE, actor_id=user.id, ip=client.ip)
    db.commit()
    return session
