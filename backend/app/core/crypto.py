"""Encryption for secrets stored in the database (e.g. the OpenRouter API key).

Fernet (AES-128-CBC + HMAC-SHA256). The key comes from APP_ENCRYPTION_KEY when set, otherwise
it is derived from JWT_SECRET. If that secret changes, stored secrets can no longer be read:
callers treat them as "not set" and an admin re-enters them.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


class SecretUnreadableError(Exception):
    pass


def _fernet() -> Fernet:
    settings = get_settings()
    material = settings.app_encryption_key or f"egsa-secrets:{settings.jwt_secret}"
    key = base64.urlsafe_b64encode(hashlib.sha256(material.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise SecretUnreadableError("Stored secret can't be decrypted (key changed?)") from exc


def secret_hint(plaintext: str) -> str:
    """Safe to display: never more than the last 4 characters."""
    return f"…{plaintext[-4:]}" if len(plaintext) >= 8 else "…"
