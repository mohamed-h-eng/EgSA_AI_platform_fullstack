"""Admin-editable settings (phase 09). Values stored in the DB override the environment."""

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.app_settings import AppSettings
from app.models.document import FileType
from app.models.user import User
from app.schemas.admin import UploadSettingsOut, UploadSettingsUpdate
from app.schemas.documents import UploadConfig
from app.schemas.projects import UserSummary
from app.services import audit
from app.services.audit import AuditAction


def _env_limits() -> tuple[int, list[FileType]]:
    settings = get_settings()
    types = [FileType(t) for t in settings.allowed_file_type_list if t in FileType]
    return settings.max_upload_mb, types


def upload_config(db: Session) -> UploadConfig:
    """Effective upload limits, read by document upload validation."""
    env_mb, env_types = _env_limits()
    row = db.get(AppSettings, 1)
    max_mb = row.max_upload_mb if row and row.max_upload_mb else env_mb
    types = (
        [FileType(t) for t in row.allowed_file_types]
        if row and row.allowed_file_types
        else env_types
    )
    return UploadConfig(
        max_upload_bytes=max_mb * 1024 * 1024, allowed_types=[str(t) for t in types]
    )


def upload_settings_out(db: Session) -> UploadSettingsOut:
    env_mb, env_types = _env_limits()
    row = db.get(AppSettings, 1)
    effective = upload_config(db)
    updated_by = db.get(User, row.updated_by_id) if row and row.updated_by_id else None
    return UploadSettingsOut(
        max_upload_mb=effective.max_upload_bytes // (1024 * 1024),
        allowed_file_types=[FileType(t) for t in effective.allowed_types],
        env_max_upload_mb=env_mb,
        env_allowed_file_types=env_types,
        overridden=bool(row and (row.max_upload_mb or row.allowed_file_types)),
        updated_at=row.updated_at if row else None,
        updated_by=UserSummary(
            id=updated_by.id, full_name=updated_by.full_name, email=updated_by.email
        )
        if updated_by
        else None,
    )


def update_upload_settings(
    db: Session, actor: User, data: UploadSettingsUpdate, *, ip: str | None
) -> UploadSettingsOut:
    before = upload_config(db)
    row = db.get(AppSettings, 1)
    if row is None:
        row = AppSettings(id=1)
        db.add(row)
    if data.reset:
        row.max_upload_mb = None
        row.allowed_file_types = None
    else:
        row.max_upload_mb = data.max_upload_mb
        row.allowed_file_types = [str(t) for t in data.allowed_file_types]
    row.updated_by_id = actor.id
    db.flush()
    after = upload_config(db)
    audit.log(
        db,
        AuditAction.SETTINGS_UPDATE,
        actor_id=actor.id,
        target_type="settings",
        target_id="uploads",
        meta={
            "reset": data.reset,
            "max_upload_mb": {
                "from": before.max_upload_bytes // (1024 * 1024),
                "to": after.max_upload_bytes // (1024 * 1024),
            },
            "allowed_file_types": {"from": before.allowed_types, "to": after.allowed_types},
        },
        ip=ip,
    )
    db.commit()
    return upload_settings_out(db)
