"""Chat through the real AIResponder with a fake provider: prompts, models, usage, streaming."""

import json
import uuid

import pytest
from sqlalchemy import select

from app.models.ai import AIUsage
from app.models.audit import AuditLog
from app.models.conversation import Message
from app.services.ai import settings as ai_settings
from app.services.ai.base import AIProviderError
from app.services.ai.responder import GUARDRAILS, AIResponder
from app.services.chat import service as chat
from tests.ai_fakes import FakeProvider
from tests.conftest import auth_header, login

API = "/api/v1"
DEFAULT = "meta-llama/llama-free:free"
OTHER = "mistral/mistral-free:free"


@pytest.fixture
def fake(monkeypatch) -> FakeProvider:
    fake = FakeProvider()
    monkeypatch.setattr(ai_settings, "make_provider", lambda base_url, api_key: fake)
    return fake


@pytest.fixture
def admin(client, make_user):
    make_user("admin@egsa.local", role="admin")
    return auth_header(login(client, "admin@egsa.local").json()["access_token"])


@pytest.fixture
def configured(client, admin, fake):
    res = client.put(
        f"{API}/admin/ai/config",
        headers=admin,
        json={
            "api_key": "sk-or-v1-testkey-0123456789",
            "default_model": DEFAULT,
            "allowed_models": [DEFAULT, OTHER],
            "system_prompt": "You are a helpful EgSA assistant.",
        },
    )
    assert res.status_code == 200
    return fake


@pytest.fixture
def user(client, make_user):
    make_user("eng@egsa.local", role="engineer")
    return auth_header(login(client, "eng@egsa.local").json()["access_token"])


def conversation(client, headers, **body) -> str:
    return client.post(f"{API}/conversations", headers=headers, json=body).json()["id"]


def send(client, headers, cid, content="What is a thermal vacuum test?", **extra):
    return client.post(
        f"{API}/conversations/{cid}/messages", headers=headers, json={"content": content, **extra}
    )


# ── Non-streaming ─────────────────────────────────────────


def test_reply_uses_system_prompt_guardrails_and_project_metadata(
    client, admin, user, configured, db
):
    from app.models.user import User

    pid = client.post(
        f"{API}/projects",
        headers=admin,
        json={"code": "NEXSAT-1", "name": "NEXSAT-1 EPS", "subsystem": "EPS"},
    ).json()["id"]
    eng = db.scalar(select(User).where(User.email == "eng@egsa.local"))
    client.post(f"{API}/projects/{pid}/members", headers=admin, json={"user_id": str(eng.id)})

    cid = conversation(client, user, project_id=pid)
    body = send(client, user, cid).json()
    assert body["assistant_message"]["content"] == "Hello from the model."
    assert body["assistant_message"]["model"] == DEFAULT
    assert body["assistant_message"]["prompt_tokens"] == 20

    messages = configured.calls[-1]["messages"]
    system = messages[0]
    assert system["role"] == "system"
    assert system["content"].startswith("You are a helpful EgSA assistant.")
    assert GUARDRAILS in system["content"]  # can't be edited away
    assert "Current project: NEXSAT-1 (NEXSAT-1 EPS)" in system["content"]
    assert "Subsystem: EPS" in system["content"]
    assert messages[1:] == [{"role": "user", "content": "What is a thermal vacuum test?"}]


def test_guardrails_forbid_claiming_document_access():
    assert "do NOT have access to EgSA documents" in GUARDRAILS
    assert "same language the user writes in" in GUARDRAILS


def test_model_selection(client, user, configured, db):
    cid = conversation(client, user)
    assert send(client, user, cid, model=OTHER).json()["assistant_message"]["model"] == OTHER
    assert configured.calls[-1]["model"] == OTHER

    rejected = send(client, user, cid, "second", model="openai/gpt-paid")
    assert rejected.status_code == 400
    assert rejected.json()["error"]["code"] == "MODEL_NOT_ALLOWED"
    # Nothing was saved for the rejected request.
    messages = client.get(f"{API}/conversations/{cid}/messages", headers=user).json()
    assert len(messages) == 2


def test_not_configured_keeps_the_message_and_explains(client, user, fake):
    cid = conversation(client, user)
    body = send(client, user, cid).json()
    assert body["user_message"]["content"] == "What is a thermal vacuum test?"
    assistant = body["assistant_message"]
    assert assistant["status"] == "error" and assistant["error_code"] == "AI_NOT_CONFIGURED"
    assert "Admin Settings" in assistant["content"]
    assert fake.calls == []


def test_provider_errors_become_retryable_messages(client, user, configured):
    cid = conversation(client, user)
    configured.fail = AIProviderError(
        "AI_RATE_LIMITED", "The free AI model is busy, please retry in a moment."
    )
    failed = send(client, user, cid).json()["assistant_message"]
    assert failed["error_code"] == "AI_RATE_LIMITED"

    configured.fail = None
    retried = client.post(f"{API}/conversations/{cid}/retry", headers=user).json()
    assert retried["assistant_message"]["status"] == "complete"


def test_usage_and_audit_are_recorded_for_every_request(client, user, configured, db):
    cid = conversation(client, user)
    send(client, user, cid)
    configured.fail = AIProviderError("AI_TIMEOUT", "The AI service took too long to respond.")
    send(client, user, cid, "again")

    db.expire_all()
    usage = list(db.scalars(select(AIUsage).order_by(AIUsage.created_at)))
    assert [(u.status, u.error_code, u.model) for u in usage] == [
        ("complete", None, DEFAULT),
        ("error", "AI_TIMEOUT", DEFAULT),
    ]
    assert usage[0].prompt_tokens == 20 and usage[0].completion_tokens == 5
    assert all(u.conversation_id == uuid.UUID(cid) for u in usage)
    audits = [a for a in db.scalars(select(AuditLog)) if a.action == "ai.request"]
    assert len(audits) == 2 and audits[0].meta["model"] == DEFAULT


# ── Streaming (SSE) ───────────────────────────────────────


def parse_sse(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


def stream(client, headers, cid, content="Explain CAN bus arbitration", **extra):
    return client.post(
        f"{API}/conversations/{cid}/messages/stream",
        headers=headers,
        json={"content": content, **extra},
    )


def test_stream_sends_start_deltas_and_done(client, user, configured, db):
    cid = conversation(client, user)
    res = stream(client, user, cid)
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    assert res.headers["x-accel-buffering"] == "no"

    events = parse_sse(res.text)
    names = [e for e, _ in events]
    assert names == ["start", "delta", "delta", "delta", "done"]
    start = events[0][1]
    assert start["user_message"]["content"] == "Explain CAN bus arbitration"
    assert start["assistant_message"]["status"] == "streaming"
    assert start["conversation"]["title"] == "Explain CAN bus arbitration"
    assert "".join(d["text"] for e, d in events if e == "delta") == "Hello from the model."
    done = events[-1][1]["assistant_message"]
    assert done["status"] == "complete" and done["content"] == "Hello from the model."
    assert done["prompt_tokens"] == 20 and done["completion_tokens"] == 3

    stored = client.get(f"{API}/conversations/{cid}/messages", headers=user).json()
    assert [(m["role"], m["status"], m["content"]) for m in stored] == [
        ("user", "complete", "Explain CAN bus arbitration"),
        ("assistant", "complete", "Hello from the model."),
    ]
    db.expire_all()
    assert db.scalar(select(AIUsage)).streamed is True


def test_stream_arabic_round_trip(client, user, configured):
    configured.stream_parts = ["الاختبار ", "الحراري ", "الفراغي"]
    cid = conversation(client, user)
    events = parse_sse(stream(client, user, cid, "ما هو الاختبار الحراري الفراغي؟").text)
    assert events[-1][1]["assistant_message"]["content"] == "الاختبار الحراري الفراغي"


def test_stream_error_before_first_token(client, user, configured):
    configured.fail = AIProviderError(
        "AI_AUTH_FAILED", "OpenRouter rejected the API key. Check the AI settings."
    )
    cid = conversation(client, user)
    events = parse_sse(stream(client, user, cid).text)
    assert [e for e, _ in events] == ["start", "error"]
    failed = events[-1][1]["assistant_message"]
    assert failed["status"] == "error" and failed["error_code"] == "AI_AUTH_FAILED"
    # Retry (non-streaming) reuses the failed row.
    configured.fail = None
    retried = client.post(f"{API}/conversations/{cid}/retry", headers=user).json()
    assert retried["assistant_message"]["id"] == failed["id"]


def test_stream_error_mid_answer(client, user, configured):
    configured.fail_after_parts = AIProviderError(
        "AI_UNAVAILABLE", "The connection to the AI service dropped."
    )
    cid = conversation(client, user)
    events = parse_sse(stream(client, user, cid).text)
    assert [e for e, _ in events][-1] == "error"
    assert events[-1][1]["assistant_message"]["error_code"] == "AI_UNAVAILABLE"


def test_stream_validation_errors_are_plain_json(client, user, configured):
    cid = conversation(client, user)
    assert stream(client, user, cid, "  ").status_code == 422
    bad_model = stream(client, user, cid, model="nope/not-allowed")
    assert bad_model.status_code == 400 and bad_model.json()["error"]["code"] == "MODEL_NOT_ALLOWED"
    assert stream(client, user, str(uuid.uuid4())).status_code == 404


def test_client_disconnect_keeps_partial_answer(
    session_factory, make_user, db, configured, client, user
):
    """Closing the generator (what Starlette does when the browser goes away) must save the
    partial text with STREAM_ABORTED rather than leave a 'streaming' message forever."""
    from app.models.user import User

    cid = uuid.UUID(conversation(client, user))
    eng = db.scalar(select(User).where(User.email == "eng@egsa.local"))
    responder = AIResponder(ai_settings.snapshot(db), configured)
    prepared = chat.prepare_stream(db, eng, responder, cid, "Tell me about solar arrays")
    events = chat.stream_events(session_factory, responder, prepared)

    assert next(events).startswith("event: start")
    assert "Hello " in next(events)
    events.close()  # client disconnected

    db.expire_all()
    message = db.get(Message, prepared.assistant_id)
    assert message.status == "error" and message.error_code == "STREAM_ABORTED"
    assert message.content == "Hello "
    assert db.scalar(select(AIUsage).where(AIUsage.error_code == "STREAM_ABORTED")) is not None
