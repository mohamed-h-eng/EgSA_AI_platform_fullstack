import re
import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import User

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_email(value: str) -> str:
    value = value.strip().lower()
    if not _EMAIL_RE.match(value):
        raise ValueError("Enter a valid email address.")
    return value


def _clean_name(value: str) -> str:
    value = " ".join(value.split())
    if not value:
        raise ValueError("Name is required.")
    return value


class UserStatus(StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"
    # Active but still on a temporary password (decision D9).
    PENDING = "pending"


class RoleRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str


class RoleOut(RoleRef):
    description: str | None
    permissions: list[str]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    job_title: str | None
    is_active: bool
    must_change_password: bool
    roles: list[RoleRef]
    last_login_at: datetime | None
    created_at: datetime

    @classmethod
    def from_user(cls, user: User) -> "UserOut":
        return cls.model_validate(user)


class UserCreate(BaseModel):
    email: str = Field(max_length=255)
    full_name: str = Field(max_length=200)
    job_title: str | None = Field(default=None, max_length=200)
    role: str = Field(max_length=64)
    # Leave empty to have a strong temporary password generated.
    temporary_password: str | None = Field(default=None, max_length=128)

    _email = field_validator("email")(_normalize_email)
    _name = field_validator("full_name")(_clean_name)


class UserUpdate(BaseModel):
    email: str | None = Field(default=None, max_length=255)
    full_name: str | None = Field(default=None, max_length=200)
    job_title: str | None = Field(default=None, max_length=200)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        return None if value is None else _normalize_email(value)

    @field_validator("full_name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        return None if value is None else _clean_name(value)


class RoleAssign(BaseModel):
    role: str = Field(max_length=64)


class PasswordReset(BaseModel):
    temporary_password: str | None = Field(default=None, max_length=128)


class TemporaryPassword(BaseModel):
    """Returned ONCE when a user is created or a password is reset. Never stored in plain text."""

    temporary_password: str


class UserCreated(TemporaryPassword):
    user: UserOut
