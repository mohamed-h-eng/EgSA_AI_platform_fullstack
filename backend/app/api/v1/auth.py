from typing import Annotated

from fastapi import APIRouter, Cookie, Response, status
from fastapi.responses import JSONResponse

from app.api.deps import Client, DbSession, PendingUser
from app.core.config import get_settings
from app.core.errors import AppError, error_body
from app.schemas.auth import CurrentUser, LoginRequest, TokenResponse
from app.services.auth import service as auth_service
from app.services.auth.service import AuthSession

router = APIRouter(prefix="/auth", tags=["auth"])

_settings = get_settings()
# The refresh cookie is only ever sent to the auth endpoints.
REFRESH_COOKIE_PATH = f"{_settings.api_prefix}/auth"

RefreshCookie = Annotated[str | None, Cookie(alias=_settings.refresh_cookie_name)]


def set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=token,
        max_age=settings.refresh_token_ttl_hours * 3600,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=get_settings().refresh_cookie_name,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=get_settings().cookie_secure,
        samesite="strict",
    )


def session_response(response: Response, session: AuthSession) -> TokenResponse:
    set_refresh_cookie(response, session.refresh_token)
    return TokenResponse(
        access_token=session.access_token,
        expires_in=session.expires_in,
        user=CurrentUser.from_user(session.user),
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, response: Response, db: DbSession, client: Client) -> TokenResponse:
    session = auth_service.login(db, body.email, body.password, client)
    return session_response(response, session)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response, db: DbSession, client: Client, refresh_token: RefreshCookie = None
) -> TokenResponse | JSONResponse:
    try:
        session = auth_service.refresh(db, refresh_token, client)
    except AppError as exc:
        # Build the error response here so the stale cookie is cleared along with it.
        error = JSONResponse(
            status_code=exc.status_code, content=error_body(exc.code, exc.message, exc.details)
        )
        clear_refresh_cookie(error)
        return error
    return session_response(response, session)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response, db: DbSession, client: Client, refresh_token: RefreshCookie = None
) -> Response:
    auth_service.logout(db, refresh_token, client)
    response.status_code = status.HTTP_204_NO_CONTENT
    clear_refresh_cookie(response)
    return response


@router.get("/me", response_model=CurrentUser)
def me(user: PendingUser) -> CurrentUser:
    return CurrentUser.from_user(user)
