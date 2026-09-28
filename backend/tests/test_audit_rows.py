"""Phase 10 audit matrix: each audited action writes exactly ONE row, with the right actor."""

from collections import Counter

from sqlalchemy import select

from app.models.audit import AuditLog
from tests.conftest import DEFAULT_PASSWORD, auth_header, login
from tests.files import pdf_bytes

API = "/api/v1"


def rows(db) -> list[AuditLog]:
    db.expire_all()
    return list(db.scalars(select(AuditLog)))


def snapshot(db) -> set:
    return {a.id for a in rows(db)}


def delta(db, before: set) -> Counter[str]:
    """Actions of the rows written since `before` (row order is not guaranteed)."""
    return Counter(a.action for a in rows(db) if a.id not in before)


def test_each_audited_action_writes_exactly_one_row(client, lib, db):
    h, u = lib["h"], lib["u"]
    admin, mohamed = h["admin"], h["mohamed"]

    def once(action: str, fn) -> None:
        before = snapshot(db)
        res = fn()
        assert res.status_code < 400, res.text
        assert delta(db, before) == Counter({action: 1}), (action, delta(db, before))

    # Users
    created = {}

    def create_user():
        res = client.post(
            f"{API}/users",
            headers=admin,
            json={"email": "new@egsa.local", "full_name": "New", "role": "viewer"},
        )
        created.update(res.json())
        return res

    once("user.create", create_user)
    uid = created["user"]["id"]
    once(
        "user.update",
        lambda: client.patch(f"{API}/users/{uid}", headers=admin, json={"job_title": "QA"}),
    )
    once(
        "user.role_change",
        lambda: client.put(f"{API}/users/{uid}/role", headers=admin, json={"role": "engineer"}),
    )
    once(
        "user.password_reset",
        lambda: client.post(f"{API}/users/{uid}/reset-password", headers=admin, json={}),
    )
    once("user.disable", lambda: client.post(f"{API}/users/{uid}/disable", headers=admin))
    once("user.enable", lambda: client.post(f"{API}/users/{uid}/enable", headers=admin))

    # Projects
    project = {}

    def create_project():
        res = client.post(f"{API}/projects", headers=admin, json={"code": "AUD-1", "name": "Aud"})
        project.update(res.json())
        return res

    once("project.create", create_project)
    pid = project["id"]
    once(
        "project.update",
        lambda: client.patch(f"{API}/projects/{pid}", headers=admin, json={"name": "Audit"}),
    )
    once(
        "project.member_add",
        lambda: client.post(
            f"{API}/projects/{pid}/members",
            headers=admin,
            json={"user_id": uid, "project_role": "viewer"},
        ),
    )
    once(
        "project.member_role_change",
        lambda: client.patch(
            f"{API}/projects/{pid}/members/{uid}", headers=admin, json={"project_role": "engineer"}
        ),
    )
    once(
        "project.member_remove",
        lambda: client.delete(f"{API}/projects/{pid}/members/{uid}", headers=admin),
    )

    # Documents
    doc = {}

    def upload():
        res = client.post(
            f"{API}/documents",
            headers=mohamed,
            data={"project_id": lib["nexsat"], "code": "AUD-DOC-1", "title": "Audit doc"},
            files={"file": ("a.pdf", pdf_bytes())},
        )
        doc.update(res.json())
        return res

    once("document.upload", upload)
    did = doc["id"]
    once(
        "document.update",
        lambda: client.patch(f"{API}/documents/{did}", headers=mohamed, json={"title": "New"}),
    )
    once(
        "document.download", lambda: client.get(f"{API}/documents/{did}/download", headers=mohamed)
    )
    once("document.delete", lambda: client.delete(f"{API}/documents/{did}", headers=mohamed))
    once("project.delete", lambda: client.delete(f"{API}/projects/{pid}", headers=admin))

    # Profile & settings
    once(
        "profile.update",
        lambda: client.patch(f"{API}/me", headers=mohamed, json={"job_title": "X"}),
    )
    once(
        "settings.update",
        lambda: client.put(
            f"{API}/admin/settings",
            headers=admin,
            json={"max_upload_mb": 5, "allowed_file_types": ["pdf"]},
        ),
    )
    once(
        "settings.ai_update",
        lambda: client.put(f"{API}/admin/ai/config", headers=admin, json={"temperature": 0.5}),
    )

    # Auth
    once("auth.login", lambda: login(client, "sara@egsa.local"))
    before = snapshot(db)
    assert login(client, "sara@egsa.local", "wrong-password").status_code == 401
    assert delta(db, before) == Counter({"auth.login_failed": 1})

    # Every audited row carries the actor who did it.
    profile = [a for a in rows(db) if a.action == "profile.update"]
    assert [a.actor_id for a in profile] == [u["mohamed"].id]


def test_logout_and_password_change_write_one_row_each(client, make_user, db):
    make_user("pw@egsa.local")
    res = login(client, "pw@egsa.local")
    token = res.json()["access_token"]

    before = snapshot(db)
    res = client.post(
        f"{API}/me/password",
        headers=auth_header(token),
        json={"current_password": DEFAULT_PASSWORD, "new_password": "Another-Pass-456!"},
    )
    assert res.status_code == 200, res.text
    assert delta(db, before) == Counter({"auth.password_change": 1})

    before = snapshot(db)
    assert client.post(f"{API}/auth/logout").status_code == 204
    assert delta(db, before) == Counter({"auth.logout": 1})
