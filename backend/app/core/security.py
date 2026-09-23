"""Password hashing, JWT access tokens and opaque refresh tokens."""

import base64
import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import get_settings

JWT_ALGORITHM = "HS256"


# ── Passwords ─────────────────────────────────────────────


def _prehash(password: str) -> bytes:
    # bcrypt only uses the first 72 bytes; SHA-256 first so long (or multi-byte Arabic)
    # passwords are fully significant.
    return base64.b64encode(hashlib.sha256(password.encode("utf-8")).digest())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_prehash(password), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_prehash(password), password_hash.encode("ascii"))
    except ValueError:
        return False


# ── Access tokens (JWT, short-lived, kept in memory by the frontend) ───


class TokenError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def create_access_token(user_id: uuid.UUID) -> tuple[str, int]:
    """Return (token, lifetime in seconds)."""
    settings = get_settings()
    ttl = timedelta(minutes=settings.access_token_ttl_min)
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + ttl,
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)
    return token, int(ttl.total_seconds())


def decode_access_token(token: str) -> uuid.UUID:
    """Return the user id, or raise TokenError("TOKEN_EXPIRED" | "INVALID_TOKEN")."""
    try:
        payload = jwt.decode(
            token,
            get_settings().jwt_secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "type"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("TOKEN_EXPIRED") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("INVALID_TOKEN") from exc

    if payload.get("type") != "access":
        raise TokenError("INVALID_TOKEN")
    try:
        return uuid.UUID(payload["sub"])
    except ValueError as exc:
        raise TokenError("INVALID_TOKEN") from exc


# ── Refresh tokens (opaque random string in an httpOnly cookie; hash stored in DB) ───


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def as_utc(value: datetime) -> datetime:
    """SQLite drops tzinfo; treat naive datetimes from the DB as UTC."""
    return value if value.tzinfo else value.replace(tzinfo=UTC)
