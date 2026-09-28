from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import Client, DbSession, require_permission
from app.models.user import User
from app.permissions.codes import PermissionCode as P
from app.schemas.admin import AuditLogOut, UploadSettingsOut, UploadSettingsUpdate
from app.schemas.common import Page, PageParams, page_params
from app.services import audit
from app.services.audit import AuditAction
from app.services.settings import service as app_settings

router = APIRouter(prefix="/admin", tags=["admin"])

Admin = Annotated[User, Depends(require_permission(P.SETTINGS_MANAGE))]
Auditor = Annotated[User, Depends(require_permission(P.AUDIT_READ))]


@router.get("/settings", response_model=UploadSettingsOut)
def get_settings(_: Admin, db: DbSession) -> UploadSettingsOut:
    return app_settings.upload_settings_out(db)


@router.put("/settings", response_model=UploadSettingsOut)
def update_settings(
    body: UploadSettingsUpdate, actor: Admin, db: DbSession, client: Client
) -> UploadSettingsOut:
    return app_settings.update_upload_settings(db, actor, body, ip=client.ip)


@router.get("/audit-logs/actions", response_model=list[str])
def list_audit_actions(_: Auditor) -> list[str]:
    return [str(a) for a in AuditAction]


@router.get("/audit-logs", response_model=Page[AuditLogOut])
def list_audit_logs(
    _: Auditor,
    db: DbSession,
    params: Annotated[PageParams, Depends(page_params)],
    actor: Annotated[str | None, Query(max_length=200)] = None,
    action: Annotated[str | None, Query(max_length=64)] = None,
    date_from: Annotated[datetime | None, Query(alias="from")] = None,
    date_to: Annotated[datetime | None, Query(alias="to")] = None,
) -> Page[AuditLogOut]:
    items, total = audit.list_logs(
        db, params, actor=actor, action=action, date_from=date_from, date_to=date_to
    )
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)
