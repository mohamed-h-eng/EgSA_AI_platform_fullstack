"""Credential verification behind an interface, so LDAP / AD / SSO can be added later (plan §8)."""

from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User

# Verified against when the email is unknown, so response time doesn't reveal which emails exist.
_DUMMY_HASH = hash_password("timing-equalizer-not-a-real-password")


def normalize_email(email: str) -> str:
    return email.strip().lower()


class AuthProvider(Protocol):
    def verify(self, db: Session, email: str, password: str) -> User | None:
        """Return the user when the credentials are valid, else None. Must not check is_active."""
        ...


class LocalPasswordProvider:
    """Local accounts with bcrypt password hashes (decision D4)."""

    def verify(self, db: Session, email: str, password: str) -> User | None:
        user = db.scalar(select(User).where(User.email == normalize_email(email)))
        if user is None:
            verify_password(password, _DUMMY_HASH)
            return None
        return user if verify_password(password, user.password_hash) else None


def get_auth_provider() -> AuthProvider:
    return LocalPasswordProvider()
