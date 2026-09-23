from fastapi import APIRouter, Response

from app.api.deps import Client, DbSession, PendingUser
from app.api.v1.auth import session_response
from app.schemas.auth import ChangePasswordRequest, TokenResponse
from app.services.auth import service as auth_service

router = APIRouter(prefix="/me", tags=["me"])


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
