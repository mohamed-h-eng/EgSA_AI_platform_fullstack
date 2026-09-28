"""Phase 09: dashboard summary, admin upload settings, audit log API, profile, audit coverage."""

import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.models.ai import AIUsage
from app.services.audit import AuditAction
from tests.conftest import auth_header, login
from tests.files import docx_bytes, pdf_bytes
from tests.test_documents import error_code, upload

API = "/api/v1"


def usage(db, user, *, status="complete", tokens=(10, 20), at=None) -> None:
    db.add(
        AIUsage(
            user_id=user.id,
            model="m",
            status=status,
            streamed=False,
            prompt_tokens=tokens[0],
            completion_tokens=tokens[1],
            meta={},
            created_at=at or datetime.now(UTC),
        )
    )
    db.commit()


# ── Dashboard ─────────────────────────────────────────────


def test_dashboard_is_scoped_to_each_user(client: TestClient, lib, db):
    h, u = lib["h"], lib["u"]
    assert upload(client, h["mohamed"], lib["nexsat"]).status_code == 201
    assert (
        upload(client, h["hussein"], lib["sar"], code="SAR-ICD-001", title="SAR ICD").status_code
        == 201
    )
    client.post(f"{API}/conversations", headers=h["mohamed"], json={"title": "Mine"})
    client.post(f"{API}/conversations", headers=h["sara"], json={"title": "Sara's"})
    usage(db, u["mohamed"])
    usage(db, u["mohamed"], status="error", tokens=(5, 0))
    usage(db, u["sara"], at=datetime.now(UTC) - timedelta(days=10))  # outside the 7-day window

    mohamed = client.get(f"{API}/dashboard/summary", headers=h["mohamed"]).json()
    assert mohamed["counts"] == {
        "projects": 1,
        "documents": 1,
        "conversations": 1,
        "ai_requests": 2,
    }
    assert [d["code"] for d in mohamed["recent_documents"]] == ["EPS-SRS-001"]
    assert [c["title"] for c in mohamed["recent_conversations"]] == ["Mine"]
    assert [p["code"] for p in mohamed["my_projects"]] == ["NEXSAT-1"]
    assert mohamed["admin"] is None

    sara = client.get(f"{API}/dashboard/summary", headers=h["sara"]).json()
    assert sara["counts"] == {"projects": 1, "documents": 1, "conversations": 1, "ai_requests": 1}
    assert sara["admin"] is None

    hussein = client.get(f"{API}/dashboard/summary", headers=h["hussein"]).json()
    assert [d["code"] for d in hussein["recent_documents"]] == ["SAR-ICD-001"]

    admin = client.get(f"{API}/dashboard/summary", headers=h["admin"]).json()
    assert admin["counts"]["projects"] == 2
    assert admin["counts"]["documents"] == 2
    stats = admin["admin"]
    assert stats["total_users"] == 6
    assert stats["active_users"] == 6
    assert stats["total_projects"] == 2
    assert stats["total_documents"] == 2
    assert stats["ai_requests_7d"] == 2
    assert stats["failed_ai_requests_7d"] == 1
    assert stats["tokens_7d"] == 35
    assert stats["ai_usage_7d"] == [
        {
            "user": {
                "id": str(u["mohamed"].id),
                "full_name": "Mohamed",
                "email": "mohamed@egsa.local",
            },
            "requests": 2,
            "failed": 1,
            "tokens": 35,
        }
    ]


def test_dashboard_requires_auth(client):
    assert client.get(f"{API}/dashboard/summary").status_code == 401


# ── Admin upload settings ─────────────────────────────────


def test_admin_upload_settings_change_upload_validation(client, lib, db):
    h = lib["h"]
    initial = client.get(f"{API}/admin/settings", headers=h["admin"]).json()
    assert initial["overridden"] is False
    assert initial["allowed_file_types"] == ["pdf", "docx", "txt"]
    assert initial["max_upload_mb"] == initial["env_max_upload_mb"]

    res = client.put(
        f"{API}/admin/settings",
        headers=h["admin"],
        json={"max_upload_mb": 1, "allowed_file_types": ["pdf", "pdf"]},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["overridden"] is True
    assert body["allowed_file_types"] == ["pdf"]
    assert body["updated_by"]["email"] == "admin@egsa.local"

    config = client.get(f"{API}/documents/upload-config", headers=h["mohamed"]).json()
    assert config == {"max_upload_bytes": 1024 * 1024, "allowed_types": ["pdf"]}

    docx = upload(client, h["mohamed"], lib["nexsat"], filename="notes.docx", content=docx_bytes())
    assert docx.status_code == 400
    assert error_code(docx) == "FILE_TYPE_NOT_ALLOWED"
    big = upload(client, h["mohamed"], lib["nexsat"], content=pdf_bytes("x" * (1024 * 1024)))
    assert error_code(big) == "FILE_TOO_LARGE"
    assert upload(client, h["mohamed"], lib["nexsat"]).status_code == 201

    reset = client.put(
        f"{API}/admin/settings",
        headers=h["admin"],
        json={"max_upload_mb": 1, "allowed_file_types": ["pdf"], "reset": True},
    ).json()
    assert reset["overridden"] is False
    assert reset["allowed_file_types"] == ["pdf", "docx", "txt"]

    logs = client.get(
        f"{API}/admin/audit-logs", headers=h["admin"], params={"action": "settings.update"}
    ).json()
    assert logs["total"] == 2
    assert logs["items"][1]["meta"]["allowed_file_types"]["to"] == ["pdf"]


@pytest.mark.parametrize(
    "body",
    [
        {"max_upload_mb": 0, "allowed_file_types": ["pdf"]},
        {"max_upload_mb": 10_000, "allowed_file_types": ["pdf"]},
        {"max_upload_mb": 10, "allowed_file_types": []},
        {"max_upload_mb": 10, "allowed_file_types": ["exe"]},
    ],
)
def test_admin_settings_validation(client, lib, body):
    assert (
        client.put(f"{API}/admin/settings", headers=lib["h"]["admin"], json=body).status_code == 422
    )


def test_admin_settings_and_audit_are_admin_only(client, lib):
    for who in ("ahmed", "mohamed", "sara"):
        h = lib["h"][who]
        assert client.get(f"{API}/admin/settings", headers=h).status_code == 403
        assert client.get(f"{API}/admin/audit-logs", headers=h).status_code == 403


# ── Audit log API ─────────────────────────────────────────


def test_audit_log_filters(client, lib):
    h = lib["h"]
    upload(client, h["mohamed"], lib["nexsat"])

    everything = client.get(f"{API}/admin/audit-logs", headers=h["admin"]).json()
    assert everything["total"] > 5
    times = [e["created_at"] for e in everything["items"]]
    assert times == sorted(times, reverse=True)

    docs = client.get(
        f"{API}/admin/audit-logs", headers=h["admin"], params={"action": "document"}
    ).json()
    assert [e["action"] for e in docs["items"]] == ["document.upload"]
    assert docs["items"][0]["actor"]["email"] == "mohamed@egsa.local"

    by_actor = client.get(
        f"{API}/admin/audit-logs", headers=h["admin"], params={"actor": "MOHAMED@"}
    ).json()
    assert {e["actor"]["email"] for e in by_actor["items"]} == {"mohamed@egsa.local"}

    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    none = client.get(f"{API}/admin/audit-logs", headers=h["admin"], params={"from": future}).json()
    assert none["total"] == 0

    actions = client.get(f"{API}/admin/audit-logs/actions", headers=h["admin"]).json()
    assert "document.upload" in actions and "settings.update" in actions


# ── Profile ───────────────────────────────────────────────


def test_profile_update(client, make_user):
    make_user("eng@egsa.local", full_name="Old Name")
    h = auth_header(login(client, "eng@egsa.local").json()["access_token"])

    assert client.get(f"{API}/me", headers=h).json()["full_name"] == "Old Name"
    res = client.patch(
        f"{API}/me", headers=h, json={"full_name": "  New   Name ", "job_title": "Power Engineer"}
    )
    assert res.status_code == 200
    assert res.json()["full_name"] == "New Name"
    assert res.json()["job_title"] == "Power Engineer"
    assert client.patch(f"{API}/me", headers=h, json={"full_name": "  "}).status_code == 422
    # Email and roles are not self-editable: extra fields are ignored.
    res = client.patch(f"{API}/me", headers=h, json={"email": "x@y.z", "job_title": None})
    assert res.json()["email"] == "eng@egsa.local"
    assert res.json()["job_title"] is None


def test_profile_requires_password_change_first(client, make_user):
    make_user("temp@egsa.local", must_change_password=True)
    h = auth_header(login(client, "temp@egsa.local").json()["access_token"])
    assert client.patch(f"{API}/me", headers=h, json={"full_name": "X"}).status_code == 403


# ── Audit coverage ────────────────────────────────────────


def test_every_audit_action_is_emitted_somewhere():
    """Each AuditAction must be used by at least one service/API module (not just declared)."""
    app_dir = Path(__file__).resolve().parents[1] / "app"
    enum_file = app_dir / "services" / "audit" / "service.py"
    sources = "\n".join(
        p.read_text(encoding="utf-8") for p in app_dir.rglob("*.py") if p != enum_file
    )
    missing = [a.name for a in AuditAction if not re.search(rf"AuditAction\.{a.name}\b", sources)]
    assert missing == []
