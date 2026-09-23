import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import User


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)


class CurrentUser(BaseModel):
    """What the frontend needs about the signed-in user (GET /auth/me)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    job_title: str | None
    roles: list[str]
    permissions: list[str]
    must_change_password: bool

    @classmethod
    def from_user(cls, user: User) -> "CurrentUser":
        return cls(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            job_title=user.job_title,
            roles=user.role_codes,
            permissions=sorted(user.permission_codes),
            must_change_password=user.must_change_password,
        )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: CurrentUser
