"""Admin-managed AI configuration (phase 07).

The OpenRouter connection is entered manually in Admin Settings: the API key is encrypted at
rest, write-only through the API, and only ever used server-side.
"""

import hashlib
import logging
import threading
import time
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.crypto import SecretUnreadableError, decrypt_secret, encrypt_secret, secret_hint
from app.core.errors import AppError
from app.models.ai import AISettings
from app.models.user import User
from app.schemas.ai import (
    AIConfigOut,
    AIConfigUpdate,
    AIModelOut,
    ConnectionTest,
    ConnectionTestResult,
)
from app.schemas.projects import UserSummary
from app.services import audit
from app.services.ai.base import AIProvider, AIProviderError, ModelInfo
from app.services.ai.openrouter import OpenRouterProvider
from app.services.audit import AuditAction

log = logging.getLogger(__name__)

CATALOG_TTL_SECONDS = 600


def make_provider(base_url: str, api_key: str) -> AIProvider:
    """Build the provider client. Tests monkeypatch this to inject a fake transport."""
    settings = get_settings()
    return OpenRouterProvider(
        base_url=base_url,
        api_key=api_key,
        timeout=settings.ai_request_timeout_seconds,
        app_url=settings.public_app_url,
    )


# ── Stored settings ───────────────────────────────────────


def get_ai_settings(db: Session) -> AISettings:
    row = db.get(AISettings, 1)
    if row is None:
        row = AISettings(id=1, allowed_models=[])
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@dataclass(frozen=True)
class AIConfigSnapshot:
    """Immutable, decrypted view of the settings used for one request."""

    base_url: str
    api_key: str | None
    default_model: str | None
    allowed_models: tuple[str, ...]
    system_prompt: str
    temperature: float
    max_tokens: int
    history_messages: int

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.default_model)


def _read_key(row: AISettings) -> tuple[str | None, bool]:
    """(plaintext key or None, unreadable flag)."""
    if not row.api_key_encrypted:
        return None, False
    try:
        return decrypt_secret(row.api_key_encrypted), False
    except SecretUnreadableError:
        log.warning("Stored OpenRouter API key can't be decrypted; an admin must re-enter it")
        return None, True


def snapshot(db: Session) -> AIConfigSnapshot:
    row = get_ai_settings(db)
    key, _ = _read_key(row)
    return AIConfigSnapshot(
        base_url=row.base_url,
        api_key=key,
        default_model=row.default_model,
        allowed_models=tuple(row.allowed_models or ()),
        system_prompt=row.system_prompt,
        temperature=row.temperature,
        max_tokens=row.max_tokens,
        history_messages=row.history_messages,
    )


def config_out(db: Session) -> AIConfigOut:
    row = get_ai_settings(db)
    key, unreadable = _read_key(row)
    updated_by = db.get(User, row.updated_by_id) if row.updated_by_id else None
    return AIConfigOut(
        provider=row.provider,
        base_url=row.base_url,
        api_key_set=key is not None,
        api_key_hint=row.api_key_hint if key is not None else None,
        api_key_unreadable=unreadable,
        configured=bool(key and row.default_model),
        default_model=row.default_model,
        allowed_models=list(row.allowed_models or []),
        system_prompt=row.system_prompt,
        temperature=row.temperature,
        max_tokens=row.max_tokens,
        history_messages=row.history_messages,
        updated_at=row.updated_at,
        updated_by=(
            UserSummary(id=updated_by.id, full_name=updated_by.full_name, email=updated_by.email)
            if updated_by
            else None
        ),
    )


def update_ai_settings(
    db: Session, actor: User, data: AIConfigUpdate, *, ip: str | None
) -> AIConfigOut:
    row = get_ai_settings(db)
    changed: list[str] = []
    fields = data.model_fields_set

    if data.clear_api_key and row.api_key_encrypted:
        row.api_key_encrypted = None
        row.api_key_hint = None
        changed.append("api_key")
    elif data.api_key:
        row.api_key_encrypted = encrypt_secret(data.api_key)
        row.api_key_hint = secret_hint(data.api_key)
        changed.append("api_key")

    for field in ("base_url", "system_prompt", "temperature", "max_tokens", "history_messages"):
        value = getattr(data, field)
        if field in fields and value is not None and getattr(row, field) != value:
            setattr(row, field, value)
            changed.append(field)

    allowed = list(row.allowed_models or [])
    if "allowed_models" in fields and data.allowed_models is not None:
        allowed = list(dict.fromkeys(m.strip() for m in data.allowed_models if m.strip()))
    default = row.default_model
    if "default_model" in fields:
        default = (data.default_model or "").strip() or None
    if default and default not in allowed:
        allowed.insert(0, default)  # the default is always selectable
    if allowed != list(row.allowed_models or []):
        row.allowed_models = allowed
        changed.append("allowed_models")
    if default != row.default_model:
        if default is None and allowed:
            raise AppError(
                "Choose a default model from the allowed models.", code="DEFAULT_MODEL_REQUIRED"
            )
        row.default_model = default
        changed.append("default_model")

    if changed:
        row.updated_by_id = actor.id
        # Never put the key (or its hint) in the audit log: only which fields changed.
        audit.log(
            db,
            AuditAction.SETTINGS_AI_UPDATE,
            actor_id=actor.id,
            target_type="ai_settings",
            meta={"changed": sorted(set(changed))},
            ip=ip,
        )
        db.commit()
        _catalog_cache.clear()
    return config_out(db)


# ── Model catalog & connection test ───────────────────────

_catalog_cache: dict[str, tuple[float, list[ModelInfo]]] = {}
_catalog_lock = threading.Lock()


def _cache_key(base_url: str, api_key: str) -> str:
    return hashlib.sha256(f"{base_url}\x00{api_key}".encode()).hexdigest()


def fetch_catalog(base_url: str, api_key: str, *, use_cache: bool = True) -> list[ModelInfo]:
    key = _cache_key(base_url, api_key)
    with _catalog_lock:
        cached = _catalog_cache.get(key)
        if use_cache and cached and time.monotonic() - cached[0] < CATALOG_TTL_SECONDS:
            return cached[1]
    models = make_provider(base_url, api_key).list_models()
    with _catalog_lock:
        _catalog_cache[key] = (time.monotonic(), models)
    return models


def available_models(db: Session, *, free_only: bool = True) -> list[AIModelOut]:
    config = snapshot(db)
    if not config.api_key:
        raise AppError("Add the OpenRouter API key first.", code="AI_NOT_CONFIGURED")
    try:
        models = fetch_catalog(config.base_url, config.api_key)
    except AIProviderError as exc:
        raise AppError(exc.message, code=exc.code) from exc
    return [
        AIModelOut(id=m.id, name=m.name, context_length=m.context_length, is_free=m.is_free)
        for m in sorted(models, key=lambda m: m.name.lower())
        if m.is_free or not free_only
    ]


def test_connection(db: Session, data: ConnectionTest) -> ConnectionTestResult:
    config = snapshot(db)
    base_url = data.base_url or config.base_url
    api_key = (data.api_key or "").strip() or config.api_key
    if not api_key:
        return ConnectionTestResult(ok=False, message="Enter an API key to test.")
    try:
        # The model catalog is public, so validate the key explicitly first.
        make_provider(base_url, api_key).check_key()
        models = fetch_catalog(base_url, api_key, use_cache=False)
    except AIProviderError as exc:
        return ConnectionTestResult(ok=False, message=exc.message)
    free = sum(1 for m in models if m.is_free)
    return ConnectionTestResult(
        ok=True,
        message=f"API key accepted: {len(models)} models available ({free} free).",
        model_count=len(models),
        free_model_count=free,
    )


def model_names(config: AIConfigSnapshot) -> dict[str, str]:
    """Display names for the allowed models (from the cached catalog when available)."""
    if not config.api_key:
        return {}
    with _catalog_lock:
        cached = _catalog_cache.get(_cache_key(config.base_url, config.api_key))
    return {m.id: m.name for m in cached[1]} if cached else {}
