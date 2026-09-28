"""Conversations and messages (plan §21–23, §27; workflows 06–07).

Owner-only in the POC. A project-linked conversation stays visible only while its owner can
still access that project (covers project soft-delete, D16, and removal from the project).
"""

import json
import logging
import time
import uuid
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.errors import AppError, ConflictError, NotFoundError
from app.models.ai import AIUsage
from app.models.conversation import Conversation, Message, MessageRole, MessageStatus
from app.models.project import Project
from app.models.user import User
from app.permissions import policies
from app.schemas.chat import ConversationOut, MessageOut, SendResult
from app.schemas.common import PageParams
from app.schemas.documents import ProjectRef
from app.services import audit
from app.services.audit import AuditAction
from app.services.chat.responder import (
    ChatContext,
    ChatResponder,
    ChatTurn,
    ResponderError,
)
from app.services.chat.titles import DEFAULT_TITLE, make_title

log = logging.getLogger(__name__)

UNAVAILABLE_TEXT = "The AI service is unavailable right now. Please try again."

# ── Queries ───────────────────────────────────────────────


def _visible_conversations(user: User) -> Select[tuple[Conversation]]:
    return select(Conversation).where(
        Conversation.user_id == user.id,
        Conversation.deleted_at.is_(None),
        or_(
            Conversation.project_id.is_(None),
            Conversation.project_id.in_(policies.visible_project_ids(user)),
        ),
    )


def get_conversation(db: Session, user: User, conversation_id: uuid.UUID) -> Conversation:
    """The user's own, visible conversation; otherwise 404 (never reveal others')."""
    conversation = db.scalar(_visible_conversations(user).where(Conversation.id == conversation_id))
    if conversation is None:
        raise NotFoundError("Conversation not found.", code="CONVERSATION_NOT_FOUND")
    return conversation


def to_out(conversation: Conversation, message_count: int | None = None) -> ConversationOut:
    project = conversation.project
    return ConversationOut(
        id=conversation.id,
        title=conversation.title,
        project=ProjectRef(id=project.id, code=project.code, name=project.name)
        if project
        else None,
        visibility=conversation.visibility,
        message_count=len(conversation.messages) if message_count is None else message_count,
        last_message_at=conversation.last_message_at,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


def message_out(message: Message) -> MessageOut:
    return MessageOut(
        id=message.id,
        position=message.position,
        role=message.role,
        content=message.content,
        model=message.model,
        status=message.status,
        error_code=message.error_code,
        prompt_tokens=message.prompt_tokens,
        completion_tokens=message.completion_tokens,
        latency_ms=message.latency_ms,
        created_at=message.created_at,
    )


def list_conversations(
    db: Session,
    user: User,
    params: PageParams,
    *,
    q: str | None = None,
    project_id: uuid.UUID | None = None,
) -> tuple[list[ConversationOut], int]:
    query = _visible_conversations(user)
    if q and q.strip():
        query = query.where(Conversation.title.icontains(q.strip(), autoescape=True))
    if project_id:
        query = query.where(Conversation.project_id == project_id)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    recent_first = func.coalesce(Conversation.last_message_at, Conversation.created_at).desc()
    conversations = list(
        db.scalars(query.order_by(recent_first).offset(params.offset).limit(params.page_size))
    )
    counts = {
        cid: n
        for cid, n in db.execute(
            select(Message.conversation_id, func.count())
            .where(Message.conversation_id.in_([c.id for c in conversations]))
            .group_by(Message.conversation_id)
        )
    }
    return [to_out(c, counts.get(c.id, 0)) for c in conversations], total


# ── Conversation commands ─────────────────────────────────


def create_conversation(
    db: Session, user: User, *, project_id: uuid.UUID | None, title: str | None
) -> Conversation:
    project = None
    if project_id is not None:
        project = db.get(Project, project_id)
        # Access is checked when the conversation is created (security rules §project access).
        if project is None or not policies.can_access_project(db, user, project):
            raise NotFoundError("Project not found.", code="PROJECT_NOT_FOUND")

    clean_title = " ".join((title or "").split())
    conversation = Conversation(
        user_id=user.id,
        project_id=project.id if project else None,
        title=clean_title or DEFAULT_TITLE,
        title_is_default=not clean_title,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def rename_conversation(
    db: Session, user: User, conversation_id: uuid.UUID, title: str
) -> Conversation:
    conversation = get_conversation(db, user, conversation_id)
    conversation.title = title
    conversation.title_is_default = False
    db.commit()
    return conversation


def delete_conversation(db: Session, user: User, conversation_id: uuid.UUID) -> None:
    """Soft delete (D16): hidden everywhere, kept in the DB."""
    conversation = get_conversation(db, user, conversation_id)
    conversation.deleted_at = datetime.now(UTC)
    db.commit()


# ── Shared helpers ────────────────────────────────────────


def _history(
    conversation: Conversation, limit: int, *, before_position: int | None = None
) -> list[ChatTurn]:
    """Recent successful turns (failed replies are never sent back to the model)."""
    messages = [
        m
        for m in conversation.messages
        if m.status == MessageStatus.COMPLETE
        and m.role in (MessageRole.USER, MessageRole.ASSISTANT)
        and (before_position is None or m.position < before_position)
    ]
    return [ChatTurn(role=m.role, content=m.content) for m in messages[-limit:]]


def _context(conversation: Conversation) -> ChatContext:
    project = conversation.project
    if project is None:
        return ChatContext()
    return ChatContext(
        project_code=project.code, project_name=project.name, subsystem=project.subsystem
    )


def _resolve_model(responder: ChatResponder, requested: str | None) -> str | None:
    """Validate the requested model BEFORE anything is saved (400, not a failed message)."""
    try:
        return responder.resolve_model(requested)
    except ResponderError as exc:
        raise AppError(exc.message, code=exc.code) from exc


def _record_usage(
    db: Session,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    message: Message,
    *,
    streamed: bool,
) -> None:
    """Usage tracking (D11) + audit trail for every AI request, successful or not."""
    db.add(
        AIUsage(
            user_id=user_id,
            conversation_id=conversation_id,
            model=message.model,
            status=message.status,
            error_code=message.error_code,
            streamed=streamed,
            prompt_tokens=message.prompt_tokens,
            completion_tokens=message.completion_tokens,
            latency_ms=message.latency_ms,
        )
    )
    audit.log(
        db,
        AuditAction.AI_REQUEST,
        actor_id=user_id,
        target_type="conversation",
        target_id=conversation_id,
        meta={
            "model": message.model,
            "status": message.status,
            "error_code": message.error_code,
            "prompt_tokens": message.prompt_tokens,
            "completion_tokens": message.completion_tokens,
            "streamed": streamed,
        },
    )


def _apply_error(message: Message, code: str, text: str) -> None:
    message.status = MessageStatus.ERROR
    message.error_code = code
    message.content = text


def _run_responder(
    responder: ChatResponder,
    conversation: Conversation,
    message: Message,
    turns: list[ChatTurn],
    model: str | None,
) -> None:
    """Fill `message` (an assistant row) with the reply, or with the error if the AI fails."""
    started = time.monotonic()
    message.model = model
    try:
        reply = responder.reply(turns, _context(conversation), model)
    except ResponderError as exc:
        _apply_error(message, exc.code, exc.message)
    except Exception:  # never lose the conversation because of an unexpected AI failure
        log.exception("Chat responder failed for conversation %s", conversation.id)
        _apply_error(message, "AI_UNAVAILABLE", UNAVAILABLE_TEXT)
    else:
        message.status = MessageStatus.COMPLETE
        message.error_code = None
        message.content = reply.content
        message.model = reply.model
        message.prompt_tokens = reply.prompt_tokens
        message.completion_tokens = reply.completion_tokens
    message.latency_ms = int((time.monotonic() - started) * 1000)


def _next_position(conversation: Conversation) -> int:
    return max((m.position for m in conversation.messages), default=0) + 1


def _save_user_message(conversation: Conversation, content: str) -> Message:
    user_message = Message(
        position=_next_position(conversation),
        role=MessageRole.USER,
        content=content,
        status=MessageStatus.COMPLETE,
    )
    conversation.messages.append(user_message)
    conversation.last_message_at = datetime.now(UTC)
    if conversation.title_is_default:
        conversation.title = make_title(content)
        conversation.title_is_default = False
    return user_message


# ── Send / retry (non-streaming) ──────────────────────────


def send_message(
    db: Session,
    user: User,
    responder: ChatResponder,
    conversation_id: uuid.UUID,
    content: str,
    *,
    model: str | None = None,
) -> SendResult:
    """Plan §22: check permission → save user message → load history → AI → save reply."""
    conversation = get_conversation(db, user, conversation_id)
    resolved = _resolve_model(responder, model)
    user_message = _save_user_message(conversation, content)
    db.commit()  # the user's message is safe even if the AI call below fails

    assistant = Message(position=user_message.position + 1, role=MessageRole.ASSISTANT, content="")
    turns = _history(conversation, responder.history_messages)
    _run_responder(responder, conversation, assistant, turns, resolved)
    conversation.messages.append(assistant)
    conversation.last_message_at = datetime.now(UTC)
    db.flush()
    _record_usage(db, user.id, conversation.id, assistant, streamed=False)
    db.commit()

    return SendResult(
        conversation=to_out(conversation),
        user_message=message_out(user_message),
        assistant_message=message_out(assistant),
    )


def retry_last(
    db: Session,
    user: User,
    responder: ChatResponder,
    conversation_id: uuid.UUID,
    *,
    model: str | None = None,
) -> SendResult:
    """Re-run the AI for the last user message: after a failure, a missing reply, or to get a
    new answer (the latest reply is replaced in place, same transcript position)."""
    conversation = get_conversation(db, user, conversation_id)
    resolved = _resolve_model(responder, model)
    last = conversation.messages[-1] if conversation.messages else None

    if (
        last is not None
        and last.role == MessageRole.ASSISTANT
        and last.status != MessageStatus.STREAMING
    ):
        assistant = last
    elif last is not None and last.role == MessageRole.USER:
        assistant = Message(position=last.position + 1, role=MessageRole.ASSISTANT, content="")
        conversation.messages.append(assistant)
    elif last is not None and last.role == MessageRole.ASSISTANT:
        raise ConflictError("The answer is still being written.", code="REPLY_IN_PROGRESS")
    else:
        raise ConflictError("There is no reply to retry.", code="NOTHING_TO_RETRY")
    return _regenerate(db, user, responder, conversation, assistant, resolved, user_message=None)


def edit_last_message(
    db: Session,
    user: User,
    responder: ChatResponder,
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    *,
    content: str,
    model: str | None = None,
) -> SendResult:
    """Edit the user's latest message and replace the reply that followed it. Only the latest
    user message can be edited, so earlier history is never rewritten (no branches in the POC)."""
    conversation = get_conversation(db, user, conversation_id)
    resolved = _resolve_model(responder, model)
    users = [m for m in conversation.messages if m.role == MessageRole.USER]
    target = users[-1] if users else None
    if target is None or target.id != message_id:
        raise ConflictError(
            "Only your latest message can be edited.", code="ONLY_LATEST_MESSAGE_EDITABLE"
        )
    after = [m for m in conversation.messages if m.position > target.position]
    if any(m.status == MessageStatus.STREAMING for m in after):
        raise ConflictError("The answer is still being written.", code="REPLY_IN_PROGRESS")

    target.content = content
    target.created_at = datetime.now(UTC)
    assistant = next((m for m in after if m.role == MessageRole.ASSISTANT), None)
    if assistant is None:
        assistant = Message(position=target.position + 1, role=MessageRole.ASSISTANT, content="")
        conversation.messages.append(assistant)
    return _regenerate(db, user, responder, conversation, assistant, resolved, user_message=target)


def _regenerate(
    db: Session,
    user: User,
    responder: ChatResponder,
    conversation: Conversation,
    assistant: Message,
    resolved: str | None,
    *,
    user_message: Message | None,
) -> SendResult:
    assistant.content = ""
    assistant.error_code = None
    assistant.prompt_tokens = None
    assistant.completion_tokens = None
    turns = _history(conversation, responder.history_messages, before_position=assistant.position)
    _run_responder(responder, conversation, assistant, turns, resolved)
    assistant.created_at = datetime.now(UTC)
    conversation.last_message_at = assistant.created_at
    db.flush()
    _record_usage(db, user.id, conversation.id, assistant, streamed=False)
    db.commit()
    return SendResult(
        conversation=to_out(conversation),
        user_message=message_out(user_message) if user_message else None,
        assistant_message=message_out(assistant),
    )


# ── Streaming (SSE, decision D5) ──────────────────────────


@dataclass(frozen=True)
class PreparedStream:
    user_id: uuid.UUID
    conversation_id: uuid.UUID
    assistant_id: uuid.UUID
    model: str | None
    turns: list[ChatTurn]
    context: ChatContext
    start_payload: dict[str, object]


def sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str, ensure_ascii=False)}\n\n"


def prepare_stream(
    db: Session,
    user: User,
    responder: ChatResponder,
    conversation_id: uuid.UUID,
    content: str,
    *,
    model: str | None = None,
) -> PreparedStream:
    """Synchronous part of a streamed send: validate, save the user message and an empty
    assistant message (status=streaming). Errors here are normal HTTP errors."""
    conversation = get_conversation(db, user, conversation_id)
    resolved = _resolve_model(responder, model)
    user_message = _save_user_message(conversation, content)
    assistant = Message(
        position=user_message.position + 1,
        role=MessageRole.ASSISTANT,
        content="",
        status=MessageStatus.STREAMING,
        model=resolved,
    )
    conversation.messages.append(assistant)
    db.commit()
    return PreparedStream(
        user_id=user.id,
        conversation_id=conversation.id,
        assistant_id=assistant.id,
        model=resolved,
        # History up to and including the new user message (not the empty assistant row).
        turns=_history(
            conversation, responder.history_messages, before_position=assistant.position
        ),
        context=_context(conversation),
        start_payload={
            "conversation": to_out(conversation).model_dump(mode="json"),
            "user_message": message_out(user_message).model_dump(mode="json"),
            "assistant_message": message_out(assistant).model_dump(mode="json"),
        },
    )


def stream_events(
    session_factory: sessionmaker[Session], responder: ChatResponder, prepared: PreparedStream
) -> Iterator[str]:
    """SSE events: start → delta* → done | error. The final state is always saved, including
    when the client disconnects mid-answer (partial text kept, error code STREAM_ABORTED)."""
    parts: list[str] = []
    tokens: dict[str, int | None] = {"prompt": None, "completion": None}
    model_used = prepared.model
    started = time.monotonic()
    finished = False

    def finish(
        status: MessageStatus, code: str | None = None, text: str | None = None
    ) -> MessageOut:
        nonlocal finished
        finished = True
        with session_factory() as db:
            message = db.get(Message, prepared.assistant_id)
            assert message is not None
            message.content = "".join(parts) if text is None else text
            message.status = status
            message.error_code = code
            message.model = model_used
            message.prompt_tokens = tokens["prompt"]
            message.completion_tokens = tokens["completion"]
            message.latency_ms = int((time.monotonic() - started) * 1000)
            conversation = db.get(Conversation, prepared.conversation_id)
            if conversation is not None:
                conversation.last_message_at = datetime.now(UTC)
            _record_usage(db, prepared.user_id, prepared.conversation_id, message, streamed=True)
            db.commit()
            return message_out(message)

    yield sse("start", prepared.start_payload)
    try:
        for chunk in responder.stream(prepared.turns, prepared.context, prepared.model):
            if chunk.model:
                model_used = chunk.model
            if chunk.prompt_tokens is not None:
                tokens["prompt"] = chunk.prompt_tokens
            if chunk.completion_tokens is not None:
                tokens["completion"] = chunk.completion_tokens
            if chunk.delta:
                parts.append(chunk.delta)
                yield sse("delta", {"text": chunk.delta})
        if not "".join(parts).strip():
            raise ResponderError("AI_EMPTY_RESPONSE", "The AI model returned an empty answer.")
        final = finish(MessageStatus.COMPLETE)
        yield sse("done", {"assistant_message": final.model_dump(mode="json")})
    except GeneratorExit:
        # The client went away: keep what we have so the transcript stays truthful.
        if not finished:
            partial = "".join(parts)
            finish(MessageStatus.ERROR, "STREAM_ABORTED", partial or "The answer was stopped.")
        raise
    except ResponderError as exc:
        final = finish(MessageStatus.ERROR, exc.code, exc.message)
        yield sse("error", {"assistant_message": final.model_dump(mode="json")})
    except Exception:
        log.exception("Streaming failed for conversation %s", prepared.conversation_id)
        final = finish(MessageStatus.ERROR, "AI_UNAVAILABLE", UNAVAILABLE_TEXT)
        yield sse("error", {"assistant_message": final.model_dump(mode="json")})
