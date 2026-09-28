import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, sessionmaker

from app.api.deps import DbSession, require_permission
from app.database.session import get_session_factory
from app.models.user import User
from app.permissions.codes import PermissionCode as P
from app.schemas.chat import (
    ConversationCreate,
    ConversationOut,
    ConversationUpdate,
    MessageCreate,
    MessageOut,
    RetryRequest,
    SendResult,
)
from app.schemas.common import Page, PageParams, page_params
from app.services.ai.responder import build_responder
from app.services.chat import service as chat
from app.services.chat.responder import ChatResponder

router = APIRouter(prefix="/conversations", tags=["chat"])

ChatUser = Annotated[User, Depends(require_permission(P.CHAT_USE))]


def get_chat_responder(db: DbSession) -> ChatResponder:
    """The AI behind chat, built from the admin's AI settings. Tests override this."""
    return build_responder(db)


Responder = Annotated[ChatResponder, Depends(get_chat_responder)]
SessionFactory = Annotated[sessionmaker[Session], Depends(get_session_factory)]


@router.get("", response_model=Page[ConversationOut])
def list_conversations(
    user: ChatUser,
    db: DbSession,
    params: Annotated[PageParams, Depends(page_params)],
    q: Annotated[str | None, Query(max_length=100)] = None,
    project_id: uuid.UUID | None = None,
) -> Page[ConversationOut]:
    items, total = chat.list_conversations(db, user, params, q=q, project_id=project_id)
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_conversation(body: ConversationCreate, user: ChatUser, db: DbSession) -> ConversationOut:
    conversation = chat.create_conversation(db, user, project_id=body.project_id, title=body.title)
    return chat.to_out(conversation)


@router.get("/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: uuid.UUID, user: ChatUser, db: DbSession) -> ConversationOut:
    return chat.to_out(chat.get_conversation(db, user, conversation_id))


@router.patch("/{conversation_id}", response_model=ConversationOut)
def rename_conversation(
    conversation_id: uuid.UUID, body: ConversationUpdate, user: ChatUser, db: DbSession
) -> ConversationOut:
    return chat.to_out(chat.rename_conversation(db, user, conversation_id, body.title))


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(conversation_id: uuid.UUID, user: ChatUser, db: DbSession) -> Response:
    chat.delete_conversation(db, user, conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
def list_messages(conversation_id: uuid.UUID, user: ChatUser, db: DbSession) -> list[MessageOut]:
    conversation = chat.get_conversation(db, user, conversation_id)
    return [chat.message_out(m) for m in conversation.messages]


@router.post(
    "/{conversation_id}/messages", response_model=SendResult, status_code=status.HTTP_201_CREATED
)
def send_message(
    conversation_id: uuid.UUID,
    body: MessageCreate,
    user: ChatUser,
    db: DbSession,
    responder: Responder,
) -> SendResult:
    """Non-streaming fallback (D5). Always 201 once the user's message is saved; a failed AI
    call comes back as an assistant message with status="error" (and can be retried)."""
    return chat.send_message(db, user, responder, conversation_id, body.content, model=body.model)


@router.post("/{conversation_id}/messages/stream")
def stream_message(
    conversation_id: uuid.UUID,
    body: MessageCreate,
    user: ChatUser,
    db: DbSession,
    responder: Responder,
    session_factory: SessionFactory,
) -> StreamingResponse:
    """Server-Sent Events (decision D5): `start`, then `delta` chunks, then `done` or `error`.
    Validation errors (404, 400, 422) are returned as normal JSON before the stream starts."""
    prepared = chat.prepare_stream(
        db, user, responder, conversation_id, body.content, model=body.model
    )
    return StreamingResponse(
        chat.stream_events(session_factory, responder, prepared),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{conversation_id}/retry", response_model=SendResult)
def retry_last_reply(
    conversation_id: uuid.UUID,
    user: ChatUser,
    db: DbSession,
    responder: Responder,
    body: RetryRequest | None = None,
) -> SendResult:
    return chat.retry_last(db, user, responder, conversation_id, model=body.model if body else None)


@router.put("/{conversation_id}/messages/{message_id}", response_model=SendResult)
def edit_last_message(
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    body: MessageCreate,
    user: ChatUser,
    db: DbSession,
    responder: Responder,
) -> SendResult:
    """Edit your latest message; its reply is regenerated in place."""
    return chat.edit_last_message(
        db, user, responder, conversation_id, message_id, content=body.content, model=body.model
    )
