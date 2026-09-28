from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import Client, DbSession, require_permission
from app.models.user import User
from app.permissions.codes import PermissionCode as P
from app.schemas.ai import (
    AIConfigOut,
    AIConfigUpdate,
    AIModelOut,
    ChatModelOut,
    ChatModelsOut,
    ConnectionTest,
    ConnectionTestResult,
)
from app.services.ai import settings as ai_settings

router = APIRouter(tags=["ai"])

ChatUser = Annotated[User, Depends(require_permission(P.CHAT_USE))]
Admin = Annotated[User, Depends(require_permission(P.SETTINGS_MANAGE))]


@router.get("/ai/models", response_model=ChatModelsOut)
def chat_models(_: ChatUser, db: DbSession) -> ChatModelsOut:
    """Models chat users may choose from: the admin's allow-list (plan §20)."""
    config = ai_settings.snapshot(db)
    names = ai_settings.model_names(config)
    return ChatModelsOut(
        configured=config.configured,
        default_model=config.default_model,
        models=[ChatModelOut(id=m, name=names.get(m, m)) for m in config.allowed_models],
    )


@router.get("/admin/ai/config", response_model=AIConfigOut)
def get_ai_config(_: Admin, db: DbSession) -> AIConfigOut:
    return ai_settings.config_out(db)


@router.put("/admin/ai/config", response_model=AIConfigOut)
def update_ai_config(
    body: AIConfigUpdate, actor: Admin, db: DbSession, client: Client
) -> AIConfigOut:
    return ai_settings.update_ai_settings(db, actor, body, ip=client.ip)


@router.post("/admin/ai/config/test", response_model=ConnectionTestResult)
def test_ai_connection(body: ConnectionTest, _: Admin, db: DbSession) -> ConnectionTestResult:
    """Checks a (possibly unsaved) key/base URL against OpenRouter by listing models."""
    return ai_settings.test_connection(db, body)


@router.get("/admin/ai/models", response_model=list[AIModelOut])
def available_models(
    _: Admin, db: DbSession, free_only: Annotated[bool, Query()] = True
) -> list[AIModelOut]:
    """The OpenRouter catalog (free models by default), for picking allowed models."""
    return ai_settings.available_models(db, free_only=free_only)
