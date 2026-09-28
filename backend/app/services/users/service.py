"""User administration (plan §9, workflow 03)."""

import secrets
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.core.security import hash_password
from app.models.role import Role
from app.models.user import User
from app.permissions.matrix import ADMIN
from app.permissions.policies import count_active_admins
from app.schemas.admin import ProfileUpdate
from app.schemas.common import PageParams
from app.schemas.users import UserCreate, UserStatus, UserUpdate
from app.services import audit
from app.services.audit import AuditAction
from app.services.auth.service import RevokeReason, revoke_all_sessions

# No look-alike characters (0/O, 1/l/I) so it can be read out or typed from a note.
_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_temporary_password() -> str:
    """e.g. 'Xk7m-Pq2r-Wz9t' (14 chars, ~70 bits)."""
    groups = ["".join(secrets.choice(_ALPHABET) for _ in range(4)) for _ in range(3)]
    return "-".join(groups)


def _resolve_temporary_password(provided: str | None) -> str:
    if not provided:
        return generate_temporary_password()
    minimum = get_settings().password_min_length
    if len(provided) < minimum:
        raise AppError(
            f"Temporary password must be at least {minimum} characters.",
            code="PASSWORD_TOO_SHORT",
        )
    return provided


def _get_role(db: Session, code: str) -> Role:
    role = db.scalar(select(Role).where(Role.code == code))
    if role is None:
        raise AppError(f"Unknown role '{code}'.", code="UNKNOWN_ROLE")
    return role


def _ensure_email_free(db: Session, email: str, *, excluding: uuid.UUID | None = None) -> None:
    query = select(User.id).where(User.email == email)
    if excluding is not None:
        query = query.where(User.id != excluding)
    if db.scalar(query) is not None:
        raise ConflictError("A user with this email already exists.", code="EMAIL_EXISTS")


def get_user(db: Session, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found.", code="USER_NOT_FOUND")
    return user


def list_users(
    db: Session,
    params: PageParams,
    *,
    q: str | None = None,
    role: str | None = None,
    status: UserStatus | None = None,
) -> tuple[list[User], int]:
    query = select(User)
    if q and q.strip():
        term = q.strip()
        query = query.where(
            or_(
                User.full_name.icontains(term, autoescape=True),
                User.email.icontains(term, autoescape=True),
            )
        )
    if role:
        query = query.where(User.roles.any(Role.code == role))
    if status == UserStatus.ACTIVE:
        query = query.where(User.is_active.is_(True), User.must_change_password.is_(False))
    elif status == UserStatus.PENDING:
        query = query.where(User.is_active.is_(True), User.must_change_password.is_(True))
    elif status == UserStatus.DISABLED:
        query = query.where(User.is_active.is_(False))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(
        query.order_by(func.lower(User.full_name), User.email)
        .offset(params.offset)
        .limit(params.page_size)
    ).all()
    return list(items), total


def create_user(db: Session, actor: User, data: UserCreate, *, ip: str | None) -> tuple[User, str]:
    _ensure_email_free(db, data.email)
    role = _get_role(db, data.role)
    temporary = _resolve_temporary_password(data.temporary_password)

    user = User(
        email=data.email,
        full_name=data.full_name,
        job_title=(data.job_title or "").strip() or None,
        password_hash=hash_password(temporary),
        must_change_password=True,
        roles=[role],
    )
    db.add(user)
    db.flush()
    audit.log(
        db,
        AuditAction.USER_CREATE,
        actor_id=actor.id,
        target_type="user",
        target_id=user.id,
        meta={"email": user.email, "role": role.code},
        ip=ip,
    )
    db.commit()
    return user, temporary


def update_user(
    db: Session, actor: User, user_id: uuid.UUID, data: UserUpdate, *, ip: str | None
) -> User:
    user = get_user(db, user_id)
    changes: dict[str, object] = {}
    if data.email is not None and data.email != user.email:
        _ensure_email_free(db, data.email, excluding=user.id)
        changes["email"] = {"from": user.email, "to": data.email}
        user.email = data.email
    if data.full_name is not None and data.full_name != user.full_name:
        changes["full_name"] = True
        user.full_name = data.full_name
    if "job_title" in data.model_fields_set:
        job_title = (data.job_title or "").strip() or None
        if job_title != user.job_title:
            changes["job_title"] = True
            user.job_title = job_title

    if changes:
        audit.log(
            db,
            AuditAction.USER_UPDATE,
            actor_id=actor.id,
            target_type="user",
            target_id=user.id,
            meta={"changed": sorted(changes)},
            ip=ip,
        )
        db.commit()
    return user


def set_active(
    db: Session, actor: User, user_id: uuid.UUID, active: bool, *, ip: str | None
) -> User:
    user = get_user(db, user_id)
    if user.is_active == active:
        return user

    if not active:
        if user.id == actor.id:
            raise ForbiddenError("You cannot disable your own account.", code="CANNOT_DISABLE_SELF")
        if ADMIN in user.role_codes and count_active_admins(db, excluding=user) == 0:
            raise ForbiddenError(
                "At least one active administrator must remain.", code="LAST_ADMIN"
            )
        revoke_all_sessions(db, user.id, RevokeReason.USER_DISABLED)

    user.is_active = active
    audit.log(
        db,
        AuditAction.USER_ENABLE if active else AuditAction.USER_DISABLE,
        actor_id=actor.id,
        target_type="user",
        target_id=user.id,
        ip=ip,
    )
    db.commit()
    return user


def assign_role(
    db: Session, actor: User, user_id: uuid.UUID, role_code: str, *, ip: str | None
) -> User:
    user = get_user(db, user_id)
    role = _get_role(db, role_code)
    previous = user.role_codes
    if previous == [role.code]:
        return user

    losing_admin = ADMIN in previous and role.code != ADMIN
    if losing_admin and user.id == actor.id:
        raise ForbiddenError(
            "You cannot remove your own administrator role.", code="CANNOT_DEMOTE_SELF"
        )
    if losing_admin and user.is_active and count_active_admins(db, excluding=user) == 0:
        raise ForbiddenError("At least one active administrator must remain.", code="LAST_ADMIN")

    # One global role per user in the POC (the table supports more for later).
    user.roles = [role]
    audit.log(
        db,
        AuditAction.USER_ROLE_CHANGE,
        actor_id=actor.id,
        target_type="user",
        target_id=user.id,
        meta={"from": previous, "to": [role.code]},
        ip=ip,
    )
    db.commit()
    return user


def reset_password(
    db: Session, actor: User, user_id: uuid.UUID, provided: str | None, *, ip: str | None
) -> str:
    user = get_user(db, user_id)
    if user.id == actor.id:
        raise ForbiddenError(
            "Use 'Change password' to change your own password.", code="CANNOT_RESET_SELF"
        )
    temporary = _resolve_temporary_password(provided)
    user.password_hash = hash_password(temporary)
    user.must_change_password = True
    user.password_changed_at = datetime.now(UTC)
    revoke_all_sessions(db, user.id, RevokeReason.PASSWORD_RESET)
    audit.log(
        db,
        AuditAction.USER_PASSWORD_RESET,
        actor_id=actor.id,
        target_type="user",
        target_id=user.id,
        ip=ip,
    )
    db.commit()
    return temporary


def list_roles(db: Session) -> list[Role]:
    return list(db.scalars(select(Role).order_by(Role.name)))


def update_profile(db: Session, user: User, data: ProfileUpdate, *, ip: str | None) -> User:
    """Self-service: name and job title only. Email and role stay admin-managed."""
    changed: list[str] = []
    if data.full_name is not None and data.full_name != user.full_name:
        user.full_name = data.full_name
        changed.append("full_name")
    if "job_title" in data.model_fields_set:
        job_title = (data.job_title or "").strip() or None
        if job_title != user.job_title:
            user.job_title = job_title
            changed.append("job_title")
    if changed:
        audit.log(
            db,
            AuditAction.PROFILE_UPDATE,
            actor_id=user.id,
            target_type="user",
            target_id=user.id,
            meta={"changed": changed},
            ip=ip,
        )
        db.commit()
    return user
