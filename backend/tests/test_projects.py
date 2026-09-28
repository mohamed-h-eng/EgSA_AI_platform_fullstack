import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.project import Project
from tests.conftest import auth_header, login

API = "/api/v1"


@pytest.fixture
def as_user(client: TestClient, make_user):
    """as_user(role, email) → (headers, user)."""

    def _as(role: str, email: str):
        user = make_user(email, role=role, full_name=email.split("@")[0].title())
        return auth_header(login(client, email).json()["access_token"]), user

    return _as


@pytest.fixture
def world(client, as_user):
    """Admin creates NEXSAT-1 and SAR; Ahmed leads NEXSAT-1, Mohamed is an engineer there,
    Hussein leads SAR. Mirrors the demo scenario (plan §16)."""
    admin, _ = as_user("admin", "admin@egsa.local")
    ahmed, ahmed_u = as_user("project_lead", "ahmed@egsa.local")
    mohamed, mohamed_u = as_user("engineer", "mohamed@egsa.local")
    hussein, hussein_u = as_user("project_lead", "hussein@egsa.local")
    viewer, viewer_u = as_user("viewer", "sara@egsa.local")

    def create(code: str, **extra) -> str:
        res = client.post(
            f"{API}/projects", headers=admin, json={"code": code, "name": code} | extra
        )
        assert res.status_code == 201, res.text
        return res.json()["id"]

    def add(pid: str, user, role: str) -> None:
        res = client.post(
            f"{API}/projects/{pid}/members",
            headers=admin,
            json={"user_id": str(user.id), "project_role": role},
        )
        assert res.status_code == 201, res.text

    nexsat = create("NEXSAT-1", subsystem="EPS", status="in_development")
    sar = create("SAR", status="planning")
    add(nexsat, ahmed_u, "lead")
    add(nexsat, mohamed_u, "engineer")
    add(nexsat, viewer_u, "viewer")
    add(sar, hussein_u, "lead")
    return {
        "admin": admin,
        "ahmed": ahmed,
        "mohamed": mohamed,
        "hussein": hussein,
        "viewer": viewer,
        "nexsat": nexsat,
        "sar": sar,
        "users": {"ahmed": ahmed_u, "mohamed": mohamed_u, "hussein": hussein_u, "sara": viewer_u},
    }


def codes(client, headers, **params) -> list[str]:
    res = client.get(f"{API}/projects", headers=headers, params=params)
    assert res.status_code == 200, res.text
    return [p["code"] for p in res.json()["items"]]


def audit_actions(db) -> list[str]:
    db.expire_all()
    return [a.action for a in db.scalars(select(AuditLog))]


# ── Visibility (plan §16) ─────────────────────────────────


def test_members_only_see_their_projects(client, world):
    assert codes(client, world["admin"]) == ["NEXSAT-1", "SAR"]
    assert codes(client, world["mohamed"]) == ["NEXSAT-1"]
    assert codes(client, world["hussein"]) == ["SAR"]
    assert codes(client, world["viewer"]) == ["NEXSAT-1"]


def test_non_member_gets_404_not_403(client, world):
    for path in (f"/projects/{world['sar']}", f"/projects/{world['sar']}/members"):
        res = client.get(API + path, headers=world["mohamed"])
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "PROJECT_NOT_FOUND"


def test_list_includes_member_count_and_my_role(client, world):
    project = client.get(f"{API}/projects", headers=world["mohamed"]).json()["items"][0]
    assert project["member_count"] == 4  # admin (creator, lead) + ahmed + mohamed + sara
    assert project["my_role"] == "engineer"


def test_search_and_status_filter(client, world):
    assert codes(client, world["admin"], q="eps") == ["NEXSAT-1"]  # matches subsystem
    assert codes(client, world["admin"], status="planning") == ["SAR"]
    assert codes(client, world["admin"], q="%") == []  # wildcards escaped


# ── Create / edit / delete ────────────────────────────────


def test_create_normalizes_code_and_makes_creator_lead(client, as_user, db):
    lead, lead_u = as_user("project_lead", "lead@egsa.local")
    res = client.post(
        f"{API}/projects", headers=lead, json={"code": " thermal-1 ", "name": "Thermal"}
    )
    assert res.status_code == 201
    body = res.json()
    assert body["code"] == "THERMAL-1"
    assert body["my_role"] == "lead"
    assert body["abilities"] == {"can_edit": True, "can_manage_members": True, "can_delete": False}
    assert "project.create" in audit_actions(db)


def test_create_validation(client, world):
    admin = world["admin"]
    dup = client.post(f"{API}/projects", headers=admin, json={"code": "nexsat-1", "name": "Dup"})
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "PROJECT_CODE_EXISTS"
    bad = client.post(f"{API}/projects", headers=admin, json={"code": "has space", "name": "X"})
    assert bad.status_code == 422
    assert (
        client.post(
            f"{API}/projects", headers=admin, json={"code": "OK-1", "name": " "}
        ).status_code
        == 422
    )


def test_engineers_and_viewers_cannot_create(client, world):
    for who in ("mohamed", "viewer"):
        res = client.post(f"{API}/projects", headers=world[who], json={"code": "X-1", "name": "X"})
        assert res.status_code == 403


def test_lead_edits_own_project_only(client, world):
    ok = client.patch(
        f"{API}/projects/{world['nexsat']}", headers=world["ahmed"], json={"status": "testing"}
    )
    assert ok.status_code == 200 and ok.json()["status"] == "testing"

    # Hussein is a lead too, but not of NEXSAT-1 → can't even see it.
    assert (
        client.patch(
            f"{API}/projects/{world['nexsat']}", headers=world["hussein"], json={"name": "x"}
        ).status_code
        == 404
    )
    # Mohamed can see NEXSAT-1 but lacks projects:update.
    assert (
        client.patch(
            f"{API}/projects/{world['nexsat']}", headers=world["mohamed"], json={"name": "x"}
        ).status_code
        == 403
    )


def test_member_lead_without_global_permission_cannot_edit(client, world, as_user):
    """Project role alone isn't enough: effective = global permission AND project role."""
    eng_lead, eng_lead_u = as_user("engineer", "englead@egsa.local")
    client.post(
        f"{API}/projects/{world['nexsat']}/members",
        headers=world["admin"],
        json={"user_id": str(eng_lead_u.id), "project_role": "lead"},
    )
    detail = client.get(f"{API}/projects/{world['nexsat']}", headers=eng_lead).json()
    assert detail["abilities"]["can_edit"] is False
    assert (
        client.patch(
            f"{API}/projects/{world['nexsat']}", headers=eng_lead, json={"name": "x"}
        ).status_code
        == 403
    )


def test_abilities_reflect_caller(client, world):
    def abilities(who):
        return client.get(f"{API}/projects/{world['nexsat']}", headers=world[who]).json()[
            "abilities"
        ]

    assert abilities("admin") == {"can_edit": True, "can_manage_members": True, "can_delete": True}
    assert abilities("ahmed") == {"can_edit": True, "can_manage_members": True, "can_delete": False}
    assert abilities("mohamed") == {
        "can_edit": False,
        "can_manage_members": False,
        "can_delete": False,
    }


def test_soft_delete_hides_project_everywhere(client, world, db):
    assert (
        client.delete(f"{API}/projects/{world['nexsat']}", headers=world["ahmed"]).status_code
        == 403
    )
    assert (
        client.delete(f"{API}/projects/{world['nexsat']}", headers=world["admin"]).status_code
        == 204
    )

    for who in ("admin", "ahmed", "mohamed"):
        assert "NEXSAT-1" not in codes(client, world[who])
        assert (
            client.get(f"{API}/projects/{world['nexsat']}", headers=world[who]).status_code == 404
        )

    db.expire_all()
    row = db.scalar(select(Project).where(Project.code == "NEXSAT-1"))
    assert row is not None and row.deleted_at is not None  # kept for audit/recovery (D16)
    assert "project.delete" in audit_actions(db)

    # The code stays reserved.
    dup = client.post(
        f"{API}/projects", headers=world["admin"], json={"code": "NEXSAT-1", "name": "Again"}
    )
    assert dup.status_code == 409


# ── Members ───────────────────────────────────────────────


def test_list_members_sorted_by_role(client, world):
    members = client.get(
        f"{API}/projects/{world['nexsat']}/members", headers=world["mohamed"]
    ).json()
    assert [m["project_role"] for m in members] == ["lead", "lead", "engineer", "viewer"]


def test_lead_manages_members_of_own_project(client, world, as_user, db):
    _, newbie = as_user("engineer", "newbie@egsa.local")
    nexsat, sar = world["nexsat"], world["sar"]

    added = client.post(
        f"{API}/projects/{nexsat}/members",
        headers=world["ahmed"],
        json={"user_id": str(newbie.id), "project_role": "viewer"},
    )
    assert added.status_code == 201
    changed = client.patch(
        f"{API}/projects/{nexsat}/members/{newbie.id}",
        headers=world["ahmed"],
        json={"project_role": "engineer"},
    )
    assert changed.json()["project_role"] == "engineer"
    assert (
        client.delete(
            f"{API}/projects/{nexsat}/members/{newbie.id}", headers=world["ahmed"]
        ).status_code
        == 204
    )

    # Ahmed can't manage SAR (not visible to him) and Mohamed can't manage NEXSAT-1.
    body = {"user_id": str(newbie.id), "project_role": "viewer"}
    assert (
        client.post(f"{API}/projects/{sar}/members", headers=world["ahmed"], json=body).status_code
        == 404
    )
    assert (
        client.post(
            f"{API}/projects/{nexsat}/members", headers=world["mohamed"], json=body
        ).status_code
        == 403
    )
    assert {"project.member_add", "project.member_role_change", "project.member_remove"} <= set(
        audit_actions(db)
    )


def test_member_validation(client, world, make_user):
    nexsat, admin = world["nexsat"], world["admin"]
    mohamed = world["users"]["mohamed"]
    dup = client.post(
        f"{API}/projects/{nexsat}/members", headers=admin, json={"user_id": str(mohamed.id)}
    )
    assert dup.json()["error"]["code"] == "ALREADY_MEMBER"

    off = make_user("off@egsa.local", is_active=False)
    inactive = client.post(
        f"{API}/projects/{nexsat}/members", headers=admin, json={"user_id": str(off.id)}
    )
    assert inactive.json()["error"]["code"] == "USER_INACTIVE"


def test_project_keeps_at_least_one_lead(client, world):
    sar, hussein = world["sar"], world["users"]["hussein"]
    admin = world["admin"]
    # The admin created SAR and is therefore a co-lead; step down so Hussein is the only lead.
    admin_id = client.get(f"{API}/auth/me", headers=admin).json()["id"]
    assert (
        client.delete(f"{API}/projects/{sar}/members/{admin_id}", headers=admin).status_code == 204
    )

    demote = client.patch(
        f"{API}/projects/{sar}/members/{hussein.id}",
        headers=admin,
        json={"project_role": "engineer"},
    )
    assert demote.json()["error"]["code"] == "LAST_PROJECT_LEAD"
    remove = client.delete(f"{API}/projects/{sar}/members/{hussein.id}", headers=admin)
    assert remove.json()["error"]["code"] == "LAST_PROJECT_LEAD"


def test_membership_grants_and_revokes_access(client, world):
    sar, mohamed = world["sar"], world["users"]["mohamed"]
    assert client.get(f"{API}/projects/{sar}", headers=world["mohamed"]).status_code == 404

    client.post(
        f"{API}/projects/{sar}/members", headers=world["admin"], json={"user_id": str(mohamed.id)}
    )
    assert client.get(f"{API}/projects/{sar}", headers=world["mohamed"]).status_code == 200

    client.delete(f"{API}/projects/{sar}/members/{mohamed.id}", headers=world["admin"])
    assert client.get(f"{API}/projects/{sar}", headers=world["mohamed"]).status_code == 404


# ── User drawer: GET /users/{id}/projects ─────────────────


def test_user_projects_are_limited_to_what_the_caller_can_see(client, world):
    ahmed = world["users"]["ahmed"]
    # Put Ahmed in SAR too; Mohamed (NEXSAT-1 only) must not learn about SAR.
    client.post(
        f"{API}/projects/{world['sar']}/members",
        headers=world["admin"],
        json={"user_id": str(ahmed.id)},
    )

    def memberships(who):
        return [
            m["code"]
            for m in client.get(f"{API}/users/{ahmed.id}/projects", headers=world[who]).json()
        ]

    assert memberships("admin") == ["NEXSAT-1", "SAR"]
    assert memberships("mohamed") == ["NEXSAT-1"]
