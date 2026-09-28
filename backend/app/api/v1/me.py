from fastapi import APIRouter, Response

from app.api.deps import Client, CurrentUser, DbSession, PendingUser
from app.api.v1.auth import session_response
from app.schemas.admin import ProfileUpdate
from app.schemas.auth import ChangePasswordRequest, TokenResponse
from app.schemas.auth import CurrentUser as CurrentUserOut
from app.services.auth import service as auth_service
from app.services.users import service as users

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=CurrentUserOut)
def get_profile(user: CurrentUser) -> CurrentUserOut:
    return CurrentUserOut.from_user(user)


@router.patch("", response_model=CurrentUserOut)
def update_profile(
    body: ProfileUpdate, user: CurrentUser, db: DbSession, client: Client
) -> CurrentUserOut:
    return CurrentUserOut.from_user(users.update_profile(db, user, body, ip=client.ip))


@router.post("/password", response_model=TokenResponse)
def change_password(
    body: ChangePasswordRequest,
    response: Response,
    user: PendingUser,
    db: DbSession,
    client: Client,
) -> TokenResponse:
    """Allowed while `must_change_password` is set (decision D9). Ends all other sessions."""
    session = auth_service.change_password(
        db, user, body.current_password, body.new_password, client
    )
    return session_response(response, session)
