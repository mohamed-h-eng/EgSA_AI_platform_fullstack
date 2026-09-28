from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.refresh_token import RefreshToken
from app.models.user import User
from tests.conftest import auth_header, login

API = "/api/v1"


@pytest.fixture
def token_for(client: TestClient, make_user) -> Callable[[str], tuple[str, User]]:
    """Create a user with the given role, log in, return (access token, user)."""

    def _token(role: str, email: str | None = None) -> tuple[str, User]:
        user = make_user(email or f"{role}@egsa.local", role=role, full_name=f"{role} user")
        return login(client, user.email).json()["access_token"], user

    return _token


@pytest.fixture
def admin(token_for) -> dict[str, str]:
    token, _ = token_for("admin")
    return auth_header(token)


def create(client: TestClient, headers, **overrides):
    body = {"email": "new@egsa.local", "full_name": "New Person", "role": "engineer"} | overrides
    return client.post(f"{API}/users", headers=headers, json=body)


def audit_actions(db) -> list[str]:
    db.expire_all()
    return [a.action for a in db.scalars(select(AuditLog))]


# ── Permission matrix (role × endpoint) ───────────────────

ENDPOINTS = [
    # method, path template, body, {role: expected status}
    ("GET", "/users", None, {"admin": 200, "project_lead": 200, "engineer": 200, "viewer": 403}),
    ("GET", "/roles", None, {"admin": 200, "project_lead": 403, "engineer": 403, "viewer": 403}),
    (
        "POST",
        "/users",
        {"email": "x@egsa.local", "full_name": "X", "role": "viewer"},
        {"admin": 201, "project_lead": 403, "engineer": 403, "viewer": 403},
    ),
    (
        "GET",
        "/users/{id}",
        None,
        {"admin": 200, "project_lead": 200, "engineer": 200, "viewer": 403},
    ),
    (
        "PATCH",
        "/users/{id}",
        {"job_title": "Changed"},
        {"admin": 200, "project_lead": 403, "engineer": 403, "viewer": 403},
    ),
    (
        "PUT",
        "/users/{id}/role",
        {"role": "viewer"},
        {"admin": 200, "project_lead": 403, "engineer": 403, "viewer": 403},
    ),
    (
        "POST",
        "/users/{id}/disable",
        None,
        {"admin": 200, "project_lead": 403, "engineer": 403, "viewer": 403},
    ),
    (
        "POST",
        "/users/{id}/reset-password",
        {},
        {"admin": 200, "project_lead": 403, "engineer": 403, "viewer": 403},
    ),
]


@pytest.mark.parametrize("role", ["admin", "project_lead", "engineer", "viewer"])
@pytest.mark.parametrize(("method", "path", "body", "expected"), ENDPOINTS)
def test_permission_matrix(client, token_for, make_user, role, method, path, body, expected):
    token, _ = token_for(role)
    target = make_user("target@egsa.local", role="engineer")
    res = client.request(
        method, API + path.format(id=target.id), headers=auth_header(token), json=body
    )
    assert res.status_code == expected[role], res.text


def test_unauthenticated_requests_are_rejected(client):
    assert client.get(f"{API}/users").status_code == 401


# ── Create & temporary passwords (D9) ─────────────────────


def test_create_user_returns_a_one_time_temporary_password(client, admin, db):
    res = create(client, admin, email="  Mohamed.Hany@EgSA.local ", full_name="  Mohamed   Hany ")
    assert res.status_code == 201
    body = res.json()
    temp = body["temporary_password"]
    assert len(temp) == 14 and temp.count("-") == 2
    assert body["user"]["email"] == "mohamed.hany@egsa.local"
    assert body["user"]["full_name"] == "Mohamed Hany"
    assert body["user"]["must_change_password"] is True
    assert body["user"]["roles"] == [{"code": "engineer", "name": "Engineer"}]

    # The temp password works but only unlocks the change-password flow.
    signed_in = login(client, "mohamed.hany@egsa.local", temp).json()
    assert signed_in["user"]["must_change_password"] is True
    assert "user.create" in audit_actions(db)
    # The password itself is never written to the audit log.
    assert all(temp not in str(a.meta) for a in db.scalars(select(AuditLog)))


def test_admin_may_choose_the_temporary_password(client, admin):
    res = create(client, admin, temporary_password="Chosen-Temp-99")
    assert res.json()["temporary_password"] == "Chosen-Temp-99"
    assert login(client, "new@egsa.local", "Chosen-Temp-99").status_code == 200

    short = create(client, admin, email="other@egsa.local", temporary_password="short")
    assert short.status_code == 400
    assert short.json()["error"]["code"] == "PASSWORD_TOO_SHORT"


def test_create_validation(client, admin):
    assert create(client, admin).status_code == 201
    dup = create(client, admin, email="NEW@egsa.local")
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "EMAIL_EXISTS"

    assert create(client, admin, email="not-an-email").status_code == 422
    assert create(client, admin, email="a@egsa.local", full_name="   ").status_code == 422
    bad_role = create(client, admin, email="b@egsa.local", role="superuser")
    assert bad_role.json()["error"]["code"] == "UNKNOWN_ROLE"


def test_reset_password_forces_change_and_ends_sessions(client, app, admin, make_user, db):
    user = make_user("eng@egsa.local")
    device = TestClient(app)
    login(device, "eng@egsa.local")

    res = client.post(f"{API}/users/{user.id}/reset-password", headers=admin, json={})
    assert res.status_code == 200
    temp = res.json()["temporary_password"]

    assert device.post(f"{API}/auth/refresh").status_code == 401  # old session gone
    assert login(client, "eng@egsa.local", temp).json()["user"]["must_change_password"] is True
    assert "user.password_reset" in audit_actions(db)


def test_admin_cannot_reset_own_password_via_admin_endpoint(client, token_for):
    token, me = token_for("admin")
    res = client.post(f"{API}/users/{me.id}/reset-password", headers=auth_header(token), json={})
    assert res.json()["error"]["code"] == "CANNOT_RESET_SELF"


# ── List, search, filter, paginate ────────────────────────


def test_list_search_filter_and_paginate(client, admin, make_user):
    make_user("sara@egsa.local", role="viewer", full_name="Sara Mohamed")
    make_user("hussein@egsa.local", role="engineer", full_name="Hussein Saleh")
    make_user("off@egsa.local", role="engineer", full_name="Old Account", is_active=False)
    make_user("temp@egsa.local", role="engineer", full_name="Temp User", must_change_password=True)
    make_user("arabic@egsa.local", role="viewer", full_name="محمد هاني")

    def names(**params) -> list[str]:
        res = client.get(f"{API}/users", headers=admin, params=params)
        assert res.status_code == 200
        return [u["full_name"] for u in res.json()["items"]]

    assert names(q="sara") == ["Sara Mohamed"]
    assert names(q="HUSSEIN@") == ["Hussein Saleh"]  # email, case-insensitive
    assert names(q="هاني") == ["محمد هاني"]  # Arabic search (D3)
    assert names(q="100%") == []  # LIKE wildcards are escaped
    assert names(role="viewer") == ["Sara Mohamed", "محمد هاني"]
    assert names(status="disabled") == ["Old Account"]
    assert names(status="pending") == ["Temp User"]
    assert "Old Account" not in names(status="active")

    page = client.get(f"{API}/users", headers=admin, params={"page": 2, "page_size": 2}).json()
    assert page["total"] == 6 and page["page"] == 2 and len(page["items"]) == 2


# ── Update, role change, enable/disable ───────────────────


def test_update_user(client, admin, make_user, db):
    user = make_user("eng@egsa.local")
    res = client.patch(
        f"{API}/users/{user.id}",
        headers=admin,
        json={"full_name": "Mohamed Hany", "job_title": "Data Scientist"},
    )
    assert res.json()["full_name"] == "Mohamed Hany"
    assert res.json()["job_title"] == "Data Scientist"

    cleared = client.patch(f"{API}/users/{user.id}", headers=admin, json={"job_title": None})
    assert cleared.json()["job_title"] is None
    assert "user.update" in audit_actions(db)

    make_user("taken@egsa.local")
    taken = client.patch(
        f"{API}/users/{user.id}", headers=admin, json={"email": "taken@egsa.local"}
    )
    assert taken.status_code == 409


def test_role_change_takes_effect_immediately(client, admin, token_for, db):
    token, user = token_for("viewer")
    assert client.get(f"{API}/users", headers=auth_header(token)).status_code == 403

    res = client.put(f"{API}/users/{user.id}/role", headers=admin, json={"role": "engineer"})
    assert res.json()["roles"][0]["code"] == "engineer"
    # Same access token, new permissions: they're loaded per request.
    assert client.get(f"{API}/users", headers=auth_header(token)).status_code == 200
    assert "user.role_change" in audit_actions(db)


def test_disable_cuts_off_the_user_and_enable_restores(client, admin, token_for, db):
    token, user = token_for("engineer")

    assert client.post(f"{API}/users/{user.id}/disable", headers=admin).json()["is_active"] is False
    assert client.get(f"{API}/auth/me", headers=auth_header(token)).status_code == 401
    db.expire_all()
    assert all(
        t.revoked_at
        for t in db.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id))
    )
    assert login(client, user.email).status_code == 403

    assert client.post(f"{API}/users/{user.id}/enable", headers=admin).json()["is_active"] is True
    assert login(client, user.email).status_code == 200
    assert {"user.disable", "user.enable"} <= set(audit_actions(db))


# ── Guardrails ────────────────────────────────────────────


def test_admin_cannot_disable_or_demote_themselves(client, token_for):
    token, me = token_for("admin")
    headers = auth_header(token)
    assert (
        client.post(f"{API}/users/{me.id}/disable", headers=headers).json()["error"]["code"]
        == "CANNOT_DISABLE_SELF"
    )
    assert (
        client.put(f"{API}/users/{me.id}/role", headers=headers, json={"role": "viewer"}).json()[
            "error"
        ]["code"]
        == "CANNOT_DEMOTE_SELF"
    )


def test_last_active_admin_guard(db, make_user):
    """Unreachable through the API today (only admins hold these permissions, and they can't
    act on themselves), but it protects future custom roles with users:disable/roles:assign."""
    from app.core.errors import ForbiddenError
    from app.services.users import service as users

    only_admin = make_user("admin@egsa.local", role="admin")
    operator = make_user("ops@egsa.local", role="project_lead")

    with pytest.raises(ForbiddenError) as disabled:
        users.set_active(db, operator, only_admin.id, False, ip=None)
    assert disabled.value.code == "LAST_ADMIN"

    with pytest.raises(ForbiddenError) as demoted:
        users.assign_role(db, operator, only_admin.id, "viewer", ip=None)
    assert demoted.value.code == "LAST_ADMIN"

    # With a second active admin, both operations are allowed.
    make_user("admin2@egsa.local", role="admin")
    assert users.assign_role(db, operator, only_admin.id, "viewer", ip=None).role_codes == [
        "viewer"
    ]


def test_validation_errors_use_the_standard_shape(client, admin):
    res = create(client, admin, email="not-an-email")
    assert res.status_code == 422
    error = res.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["message"] == "Enter a valid email address."
    assert error["details"]["errors"][0]["loc"] == ["body", "email"]
