"""Shared FastAPI dependencies.

    DbSession                       SQLAlchemy session
    PendingUser                     authenticated user, even with a pending password change
    CurrentUser                     authenticated user who is allowed to use the platform
    require_permission(code, ...)   CurrentUser that holds ALL the given permission codes

Phase 04 adds require_project_access().
"""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import TokenError, decode_access_token
from app.database.session import get_db
from app.models.user import User
from app.permissions.codes import PermissionCode
from app.services.auth.service import ClientInfo

DbSession = Annotated[Session, Depends(get_db)]

_bearer = HTTPBearer(auto_error=False)

_TOKEN_MESSAGES = {
    "TOKEN_EXPIRED": "Your session token has expired.",
    "INVALID_TOKEN": "Invalid authentication token.",
}


def get_client_info(request: Request) -> ClientInfo:
    return ClientInfo(
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


Client = Annotated[ClientInfo, Depends(get_client_info)]


def _get_pending_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise UnauthorizedError("Authentication required.", code="NOT_AUTHENTICATED")
    try:
        user_id = decode_access_token(credentials.credentials)
    except TokenError as exc:
        raise UnauthorizedError(_TOKEN_MESSAGES[exc.code], code=exc.code) from exc

    user = db.get(User, user_id)
    if user is None:
        raise UnauthorizedError(_TOKEN_MESSAGES["INVALID_TOKEN"], code="INVALID_TOKEN")
    if not user.is_active:
        # Disabled users are cut off immediately, even with an unexpired token.
        raise UnauthorizedError("Your account is disabled.", code="ACCOUNT_DISABLED")
    return user


PendingUser = Annotated[User, Depends(_get_pending_user)]


def _get_current_user(user: PendingUser) -> User:
    if user.must_change_password:
        raise ForbiddenError(
            "You must change your password before continuing.", code="PASSWORD_CHANGE_REQUIRED"
        )
    return user


CurrentUser = Annotated[User, Depends(_get_current_user)]


def require_permission(*codes: PermissionCode) -> Callable[[User], User]:
    """Dependency factory: `user: Annotated[User, Depends(require_permission(P.USERS_READ))]`."""

    def dependency(user: CurrentUser) -> User:
        missing = [c for c in codes if not user.has_permission(c)]
        if missing:
            raise ForbiddenError(
                "You do not have permission to perform this action.",
                code="FORBIDDEN",
                details={"missing": [str(c) for c in missing]},
            )
        return user

    return dependency
