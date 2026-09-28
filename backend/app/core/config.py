from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, read from environment variables / .env."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "EgSA AI Engineering Platform"
    api_prefix: str = "/api/v1"
    environment: str = "development"

    # Database
    database_url: str = "postgresql+psycopg://egsa:change-me@localhost:5432/egsa_ai"

    # Auth
    jwt_secret: str = "change-me"
    access_token_ttl_min: int = 15
    refresh_token_ttl_hours: int = 8
    refresh_cookie_name: str = "egsa_refresh"
    # Must be true when served over HTTPS; false for http://localhost.
    cookie_secure: bool = False
    # A rotated refresh token presented again within this window is treated as a multi-tab
    # race (rejected) rather than theft (which revokes every session).
    refresh_reuse_grace_seconds: int = 10
    login_max_attempts: int = 5
    login_window_seconds: int = 900
    password_min_length: int = 10
    # bcrypt work factor. Keep 12+ in real deployments; tests lower it for speed.
    bcrypt_rounds: int = 12

    # Storage
    storage_root: str = "./storage"
    max_upload_mb: int = 50
    allowed_file_types: str = "pdf,docx,txt"

    # AI: the OpenRouter connection (API key, base URL, models) is configured by an admin in
    # Admin Settings and stored encrypted in the DB, not in environment variables.
    # Optional dedicated key for encrypting DB secrets; derived from JWT_SECRET when empty.
    app_encryption_key: str = ""
    ai_request_timeout_seconds: float = 60.0
    # Sent to OpenRouter as HTTP-Referer / X-Title (app attribution).
    public_app_url: str = "http://localhost"

    # Seed
    seed_admin_email: str = "admin@egsa.local"
    seed_admin_password: str = "change-me"
    seed_demo: bool = False
    # Shared password for the fake demo accounts (D12). Empty = demo users are not created.
    seed_demo_password: str = ""

    # CORS (comma-separated)
    cors_origins: str = Field(default="http://localhost:5173")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_file_type_list(self) -> list[str]:
        return [t.strip().lower() for t in self.allowed_file_types.split(",") if t.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
