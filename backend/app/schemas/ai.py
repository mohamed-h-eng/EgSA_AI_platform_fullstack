from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.projects import UserSummary


def _clean_url(value: str) -> str:
    value = value.strip().rstrip("/")
    if not value.startswith(("https://", "http://")):
        raise ValueError("Enter a full URL, e.g. https://openrouter.ai/api/v1")
    return value


class AIConfigOut(BaseModel):
    """What admins see. The API key itself is NEVER returned: only whether it is set."""

    provider: str
    base_url: str
    api_key_set: bool
    api_key_hint: str | None
    # The stored key exists but can't be decrypted (encryption secret changed): re-enter it.
    api_key_unreadable: bool
    configured: bool
    default_model: str | None
    allowed_models: list[str]
    system_prompt: str
    temperature: float
    max_tokens: int
    history_messages: int
    updated_at: datetime | None
    updated_by: UserSummary | None


class AIConfigUpdate(BaseModel):
    base_url: str | None = Field(default=None, max_length=255)
    # Write-only. Omit to keep the current key; send `clear_api_key` to remove it.
    api_key: str | None = Field(default=None, min_length=10, max_length=512)
    clear_api_key: bool = False
    default_model: str | None = Field(default=None, max_length=128)
    allowed_models: list[str] | None = Field(default=None, max_length=50)
    system_prompt: str | None = Field(default=None, min_length=1, max_length=4000)
    temperature: float | None = Field(default=None, ge=0, le=2)
    max_tokens: int | None = Field(default=None, ge=64, le=8192)
    history_messages: int | None = Field(default=None, ge=2, le=100)

    _url = field_validator("base_url")(lambda v: None if v is None else _clean_url(v))

    @field_validator("api_key")
    @classmethod
    def _key(cls, value: str | None) -> str | None:
        return None if value is None else value.strip()


class ConnectionTest(BaseModel):
    """Test unsaved values (from the form); anything omitted falls back to the saved config."""

    base_url: str | None = Field(default=None, max_length=255)
    api_key: str | None = Field(default=None, max_length=512)

    _url = field_validator("base_url")(lambda v: None if v is None else _clean_url(v))


class ConnectionTestResult(BaseModel):
    ok: bool
    message: str
    model_count: int = 0
    free_model_count: int = 0


class AIModelOut(BaseModel):
    id: str
    name: str
    context_length: int | None
    is_free: bool


class ChatModelOut(BaseModel):
    id: str
    name: str


class ChatModelsOut(BaseModel):
    """Models a chat user may pick from (the admin's allow-list)."""

    configured: bool
    default_model: str | None
    models: list[ChatModelOut]
