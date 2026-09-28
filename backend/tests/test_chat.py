import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.v1.conversations import get_chat_responder
from app.models.conversation import Conversation
from app.services.ai.base import StreamChunk
from app.services.chat.responder import (
    ChatContext,
    ChatTurn,
    Reply,
    ResponderError,
)
from app.services.chat.titles import make_title
from tests.conftest import auth_header, login

API = "/api/v1"


class ScriptedResponder:
    """Records what the chat service sends to the AI and replies/fails on demand."""

    history_messages = 20

    def __init__(self) -> None:
        self.calls: list[tuple[list[ChatTurn], ChatContext]] = []
        self.fail_with: ResponderError | Exception | None = None

    def resolve_model(self, requested: str | None) -> str | None:
        return requested or "test-model"

    def stream(self, turns, context, model):  # not used by these tests
        yield StreamChunk(delta="x")

    def reply(self, turns: list[ChatTurn], context: ChatContext, model: str | None) -> Reply:
        self.calls.append((turns, context))
        if self.fail_with is not None:
            raise self.fail_with
        return Reply(
            content=f"answer #{len(self.calls)}",
            model="test-model",
            prompt_tokens=11,
            completion_tokens=7,
        )


@pytest.fixture
def responder(app) -> ScriptedResponder:
    fake = ScriptedResponder()
    app.dependency_overrides[get_chat_responder] = lambda: fake
    return fake


@pytest.fixture
def people(client: TestClient, make_user):
    out = {}
    for key, role in [
        ("admin", "admin"),
        ("mohamed", "engineer"),
        ("sara", "viewer"),
        ("hussein", "project_lead"),
    ]:
        make_user(f"{key}@egsa.local", role=role, full_name=key.title())
        out[key] = auth_header(login(client, f"{key}@egsa.local").json()["access_token"])
    return out


@pytest.fixture
def nexsat(client, people, db) -> str:
    """NEXSAT-1 with Mohamed as a member; Hussein is not."""
    from app.models.user import User

    pid = client.post(
        f"{API}/projects",
        headers=people["admin"],
        json={"code": "NEXSAT-1", "name": "NEXSAT-1 EPS", "subsystem": "EPS"},
    ).json()["id"]
    mohamed = db.scalar(select(User).where(User.email == "mohamed@egsa.local"))
    client.post(
        f"{API}/projects/{pid}/members", headers=people["admin"], json={"user_id": str(mohamed.id)}
    )
    return pid


def new_conversation(client, headers, **body) -> dict:
    res = client.post(f"{API}/conversations", headers=headers, json=body)
    assert res.status_code == 201, res.text
    return res.json()


def send(client, headers, conversation_id: str, content: str):
    return client.post(
        f"{API}/conversations/{conversation_id}/messages",
        headers=headers,
        json={"content": content},
    )


# ── Conversations ─────────────────────────────────────────


def test_every_role_can_chat(client, people, responder):
    """Decision D10: chat:use for all roles, including Viewers."""
    for who in ("admin", "mohamed", "sara", "hussein"):
        conv = new_conversation(client, people[who])
        assert send(client, people[who], conv["id"], "hello").status_code == 201


def test_new_conversation_defaults(client, people):
    conv = new_conversation(client, people["mohamed"])
    assert conv["title"] == "New conversation"
    assert conv["project"] is None
    assert conv["visibility"] == "private"
    assert conv["message_count"] == 0


def test_users_only_see_their_own_conversations(client, people, responder):
    mine = new_conversation(client, people["mohamed"])
    send(client, people["mohamed"], mine["id"], "private question")

    others = client.get(f"{API}/conversations", headers=people["sara"]).json()
    assert others["total"] == 0
    for method, path in [
        ("GET", f"/conversations/{mine['id']}"),
        ("GET", f"/conversations/{mine['id']}/messages"),
        ("PATCH", f"/conversations/{mine['id']}"),
        ("DELETE", f"/conversations/{mine['id']}"),
        ("POST", f"/conversations/{mine['id']}/messages"),
        ("POST", f"/conversations/{mine['id']}/retry"),
    ]:
        res = client.request(
            method, API + path, headers=people["admin"], json={"title": "x", "content": "x"}
        )
        assert res.status_code == 404, (method, path, res.status_code)  # even admins
        assert res.json()["error"]["code"] == "CONVERSATION_NOT_FOUND"


def test_project_link_requires_access_at_creation(client, people, nexsat):
    ok = new_conversation(client, people["mohamed"], project_id=nexsat)
    assert ok["project"]["code"] == "NEXSAT-1"
    denied = client.post(
        f"{API}/conversations", headers=people["hussein"], json={"project_id": nexsat}
    )
    assert denied.status_code == 404
    assert denied.json()["error"]["code"] == "PROJECT_NOT_FOUND"


def test_project_conversations_disappear_when_access_is_lost(client, people, nexsat, db):
    from app.models.user import User

    conv = new_conversation(client, people["mohamed"], project_id=nexsat)
    new_conversation(client, people["mohamed"])  # unrelated, stays visible
    mohamed = db.scalar(select(User).where(User.email == "mohamed@egsa.local"))

    client.delete(f"{API}/projects/{nexsat}/members/{mohamed.id}", headers=people["admin"])
    listed = client.get(f"{API}/conversations", headers=people["mohamed"]).json()
    assert listed["total"] == 1
    assert (
        client.get(f"{API}/conversations/{conv['id']}", headers=people["mohamed"]).status_code
        == 404
    )


def test_project_soft_delete_hides_linked_conversations(client, people, nexsat):
    conv = new_conversation(client, people["mohamed"], project_id=nexsat)
    client.delete(f"{API}/projects/{nexsat}", headers=people["admin"])
    assert (
        client.get(f"{API}/conversations/{conv['id']}", headers=people["mohamed"]).status_code
        == 404
    )


def test_rename_and_soft_delete(client, people, responder, db):
    conv = new_conversation(client, people["mohamed"])
    renamed = client.patch(
        f"{API}/conversations/{conv['id']}",
        headers=people["mohamed"],
        json={"title": "  EPS   review "},
    )
    assert renamed.json()["title"] == "EPS review"
    assert (
        client.patch(
            f"{API}/conversations/{conv['id']}", headers=people["mohamed"], json={"title": " "}
        ).status_code
        == 422
    )

    # A manual title is never overwritten by the automatic one.
    send(client, people["mohamed"], conv["id"], "Battery requirements?")
    assert (
        client.get(f"{API}/conversations/{conv['id']}", headers=people["mohamed"]).json()["title"]
        == "EPS review"
    )

    assert (
        client.delete(f"{API}/conversations/{conv['id']}", headers=people["mohamed"]).status_code
        == 204
    )
    assert (
        client.get(f"{API}/conversations/{conv['id']}", headers=people["mohamed"]).status_code
        == 404
    )
    db.expire_all()
    assert db.get(Conversation, uuid.UUID(conv["id"])).deleted_at is not None  # kept (D16)


def test_list_search_order_and_pagination(client, people, responder):
    h = people["mohamed"]
    first = new_conversation(client, h)
    second = new_conversation(client, h)
    send(client, h, first["id"], "Battery undervoltage requirements")
    send(client, h, second["id"], "CAN timeout analysis")
    send(client, h, first["id"], "follow-up")  # first becomes the most recent

    listed = client.get(f"{API}/conversations", headers=h).json()
    assert [c["title"] for c in listed["items"]] == [
        "Battery undervoltage requirements",
        "CAN timeout analysis",
    ]
    assert listed["items"][0]["message_count"] == 4
    assert [
        c["title"]
        for c in client.get(f"{API}/conversations", headers=h, params={"q": "can"}).json()["items"]
    ] == ["CAN timeout analysis"]
    page = client.get(f"{API}/conversations", headers=h, params={"page": 2, "page_size": 1}).json()
    assert page["total"] == 2 and page["items"][0]["title"] == "CAN timeout analysis"


# ── Messages ──────────────────────────────────────────────


def test_send_saves_both_messages_in_order(client, people, responder):
    h = people["mohamed"]
    conv = new_conversation(client, h)
    res = send(client, h, conv["id"], "What are typical battery requirements?")
    assert res.status_code == 201
    body = res.json()
    assert body["user_message"]["role"] == "user" and body["user_message"]["position"] == 1
    assistant = body["assistant_message"]
    assert assistant["role"] == "assistant" and assistant["position"] == 2
    assert assistant["status"] == "complete" and assistant["content"] == "answer #1"
    assert assistant["model"] == "test-model"
    assert assistant["prompt_tokens"] == 11 and assistant["completion_tokens"] == 7
    assert assistant["latency_ms"] >= 0
    assert body["conversation"]["title"] == "What are typical battery requirements?"

    send(client, h, conv["id"], "And for the solar array?")
    messages = client.get(f"{API}/conversations/{conv['id']}/messages", headers=h).json()
    assert [(m["position"], m["role"]) for m in messages] == [
        (1, "user"),
        (2, "assistant"),
        (3, "user"),
        (4, "assistant"),
    ]


def test_history_and_project_context_reach_the_responder(client, people, responder, nexsat):
    h = people["mohamed"]
    conv = new_conversation(client, h, project_id=nexsat)
    send(client, h, conv["id"], "first")
    send(client, h, conv["id"], "second")

    turns, context = responder.calls[-1]
    assert [(t.role, t.content) for t in turns] == [
        ("user", "first"),
        ("assistant", "answer #1"),
        ("user", "second"),
    ]
    assert context == ChatContext(
        project_code="NEXSAT-1", project_name="NEXSAT-1 EPS", subsystem="EPS"
    )


def test_history_is_limited(client, people, responder):
    responder.history_messages = 3  # comes from the admin AI settings in production
    h = people["mohamed"]
    conv = new_conversation(client, h)
    for i in range(3):
        send(client, h, conv["id"], f"q{i}")
    turns, _ = responder.calls[-1]
    # Last 3 successful turns before the reply: q1, its answer, q2.
    assert [t.content for t in turns] == ["q1", "answer #2", "q2"]


def test_arabic_and_mixed_content_round_trips_unchanged(client, people, responder):
    h = people["mohamed"]
    conv = new_conversation(client, h)
    text = "ما هي متطلبات البطارية؟ Battery undervoltage = 24 V\n  - تحقق من ذلك  "
    send(client, h, conv["id"], text)
    stored = client.get(f"{API}/conversations/{conv['id']}/messages", headers=h).json()[0][
        "content"
    ]
    assert stored == text  # byte-for-byte, whitespace included


@pytest.mark.parametrize("content", ["", "   \n\t "])
def test_blank_messages_are_rejected(client, people, content):
    conv = new_conversation(client, people["mohamed"])
    res = send(client, people["mohamed"], conv["id"], content)
    assert res.status_code == 422
    assert res.json()["error"]["message"] == "Message can't be empty."


def test_overlong_messages_are_rejected(client, people):
    conv = new_conversation(client, people["mohamed"])
    assert send(client, people["mohamed"], conv["id"], "x" * 20_001).status_code == 422


# ── AI failures & retry ───────────────────────────────────


def test_ai_failure_keeps_the_user_message_and_can_be_retried(client, people, responder):
    h = people["mohamed"]
    conv = new_conversation(client, h)
    responder.fail_with = ResponderError(
        "AI_RATE_LIMITED", "The free AI model is busy, please retry in a moment."
    )

    res = send(client, h, conv["id"], "hello?")
    assert res.status_code == 201
    failed = res.json()["assistant_message"]
    assert failed["status"] == "error" and failed["error_code"] == "AI_RATE_LIMITED"
    assert "busy" in failed["content"]

    responder.fail_with = None
    retried = client.post(f"{API}/conversations/{conv['id']}/retry", headers=h).json()
    assert retried["user_message"] is None
    assert retried["assistant_message"]["id"] == failed["id"]  # same row, same position
    assert retried["assistant_message"]["status"] == "complete"
    messages = client.get(f"{API}/conversations/{conv['id']}/messages", headers=h).json()
    assert [(m["role"], m["status"]) for m in messages] == [
        ("user", "complete"),
        ("assistant", "complete"),
    ]


def test_failed_replies_are_not_sent_back_as_history(client, people, responder):
    h = people["mohamed"]
    conv = new_conversation(client, h)
    responder.fail_with = RuntimeError("boom")  # unexpected error → generic AI_UNAVAILABLE
    failed = send(client, h, conv["id"], "first").json()["assistant_message"]
    assert failed["error_code"] == "AI_UNAVAILABLE"

    responder.fail_with = None
    send(client, h, conv["id"], "second")
    turns, _ = responder.calls[-1]
    assert [t.content for t in turns] == ["first", "second"]


def test_retry_with_nothing_to_retry(client, people, responder):
    h = people["mohamed"]
    conv = new_conversation(client, h)
    assert (
        client.post(f"{API}/conversations/{conv['id']}/retry", headers=h).json()["error"]["code"]
        == "NOTHING_TO_RETRY"
    )
    send(client, h, conv["id"], "hi")
    assert client.post(f"{API}/conversations/{conv['id']}/retry", headers=h).status_code == 409


# ── Titles (D3) ───────────────────────────────────────────


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("  Battery\n  requirements  ", "Battery requirements"),
        ("", "New conversation"),
        ("a" * 60, "a" * 60),
        ("word " * 20, ("word " * 12).strip() + "…"),
    ],
)
def test_make_title(text, expected):
    assert make_title(text) == expected


def test_make_title_is_character_safe_for_arabic():
    text = "ما هي متطلبات الجهد المنخفض للبطارية في نظام الطاقة الكهربائية للقمر الصناعي نكسات"
    title = make_title(text)
    assert title.endswith("…") and len(title) <= 61
    assert text.startswith(title[:-1])  # a clean prefix: no broken characters
    # Harakat (combining marks) are never left dangling at the cut.
    vocalized = "بَ" * 40
    cut = make_title(vocalized)
    assert not cut[:-1].endswith("َ") or cut[:-1].endswith("بَ")
