from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.deps import CurrentUser, require_permission
from app.core.config import get_settings
from app.core.security import JWT_ALGORITHM
from app.models.audit import AuditLog
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.permissions.codes import PermissionCode
from tests.conftest import DEFAULT_PASSWORD, auth_header, login

COOKIE = get_settings().refresh_cookie_name


def actions(db) -> list[str]:
    db.expire_all()
    return [a.action for a in db.scalars(select(AuditLog).order_by(AuditLog.created_at))]


# ── Login ─────────────────────────────────────────────────


def test_login_returns_token_user_and_httponly_refresh_cookie(client, make_user, db):
    make_user("eng@egsa.local", role="engineer")

    res = login(client, "ENG@egsa.local ")  # case and whitespace insensitive

    assert res.status_code == 200
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 15 * 60
    assert body["user"]["email"] == "eng@egsa.local"
    assert body["user"]["roles"] == ["engineer"]
    assert "documents:upload" in body["user"]["permissions"]
    assert "users:create" not in body["user"]["permissions"]

    set_cookie = res.headers["set-cookie"]
    assert f"{COOKIE}=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "SameSite=strict" in set_cookie
    assert "Path=/api/v1/auth" in set_cookie
    assert "auth.login" in actions(db)


def test_login_wrong_password_is_rejected_and_audited(client, make_user, db):
    make_user("eng@egsa.local")
    res = login(client, "eng@egsa.local", "wrong-password")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "INVALID_CREDENTIALS"
    assert "auth.login_failed" in actions(db)


def test_login_unknown_email_gives_same_error(client):
    res = login(client, "nobody@egsa.local")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_disabled_user_cannot_log_in(client, make_user):
    make_user("off@egsa.local", is_active=False)
    res = login(client, "off@egsa.local")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "ACCOUNT_DISABLED"


def test_login_is_rate_limited_after_repeated_failures(client, make_user):
    make_user("eng@egsa.local")
    for _ in range(get_settings().login_max_attempts):
        assert login(client, "eng@egsa.local", "bad").status_code == 401
    res = login(client, "eng@egsa.local")  # even the right password is blocked now
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "TOO_MANY_ATTEMPTS"


# ── /me and access tokens ─────────────────────────────────


def test_me_requires_a_token(client):
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "NOT_AUTHENTICATED"


def test_me_with_valid_token(client, make_user):
    make_user("eng@egsa.local", full_name="Mohamed Hany")
    token = login(client, "eng@egsa.local").json()["access_token"]
    res = client.get("/api/v1/auth/me", headers=auth_header(token))
    assert res.status_code == 200
    assert res.json()["full_name"] == "Mohamed Hany"


def test_expired_access_token_is_rejected(client, make_user):
    user = make_user("eng@egsa.local")
    past = datetime.now(UTC) - timedelta(minutes=1)
    token = jwt.encode(
        {"sub": str(user.id), "type": "access", "exp": past},
        get_settings().jwt_secret,
        algorithm=JWT_ALGORITHM,
    )
    res = client.get("/api/v1/auth/me", headers=auth_header(token))
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "TOKEN_EXPIRED"


def test_tampered_token_is_rejected(client, make_user):
    make_user("eng@egsa.local")
    token = login(client, "eng@egsa.local").json()["access_token"]
    res = client.get("/api/v1/auth/me", headers=auth_header(token[:-3] + "abc"))
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "INVALID_TOKEN"


def test_disabling_a_user_cuts_off_existing_tokens(client, make_user, db):
    user = make_user("eng@egsa.local")
    token = login(client, "eng@egsa.local").json()["access_token"]
    db.get(User, user.id).is_active = False
    db.commit()
    res = client.get("/api/v1/auth/me", headers=auth_header(token))
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "ACCOUNT_DISABLED"


# ── Refresh & logout ──────────────────────────────────────


def test_refresh_rotates_the_cookie(client, make_user):
    make_user("eng@egsa.local")
    login(client, "eng@egsa.local")
    first = client.cookies.get(COOKIE)

    res = client.post("/api/v1/auth/refresh")
    assert res.status_code == 200
    assert res.json()["access_token"]
    second = client.cookies.get(COOKIE)
    assert second and second != first


def test_reusing_a_rotated_refresh_token_revokes_all_sessions(client, make_user, db):
    make_user("eng@egsa.local")
    login(client, "eng@egsa.local")
    stolen = client.cookies.get(COOKIE)
    assert client.post("/api/v1/auth/refresh").status_code == 200  # legitimate rotation
    _age_revocations(db, minutes=1)  # replay happens well after the multi-tab grace window

    client.cookies.set(COOKIE, stolen, path="/api/v1/auth")
    res = client.post("/api/v1/auth/refresh")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "REFRESH_TOKEN_INVALID"

    db.expire_all()
    assert all(t.revoked_at is not None for t in db.scalars(select(RefreshToken)))
    assert "auth.refresh_reuse_detected" in actions(db)


def _age_revocations(db, minutes: int) -> None:
    db.expire_all()
    for token in db.scalars(select(RefreshToken).where(RefreshToken.revoked_at.is_not(None))):
        token.revoked_at = datetime.now(UTC) - timedelta(minutes=minutes)
    db.commit()


def test_concurrent_refresh_from_two_tabs_is_not_treated_as_theft(client, make_user, db):
    make_user("eng@egsa.local")
    login(client, "eng@egsa.local")
    old = client.cookies.get(COOKIE)
    assert client.post("/api/v1/auth/refresh").status_code == 200  # tab A rotates
    new = client.cookies.get(COOKIE)

    client.cookies.set(COOKIE, old, path="/api/v1/auth")  # tab B raced with the old cookie
    assert client.post("/api/v1/auth/refresh").status_code == 401

    client.cookies.set(COOKIE, new, path="/api/v1/auth")
    assert client.post("/api/v1/auth/refresh").status_code == 200  # tab A's session survives
    assert "auth.refresh_reuse_detected" not in actions(db)


def test_refresh_without_cookie_fails(client):
    res = client.post("/api/v1/auth/refresh")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "REFRESH_TOKEN_INVALID"


def test_expired_refresh_token_fails(client, make_user, db):
    make_user("eng@egsa.local")
    login(client, "eng@egsa.local")
    for token in db.scalars(select(RefreshToken)):
        token.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db.commit()
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_logout_revokes_the_refresh_token(client, make_user, db):
    make_user("eng@egsa.local")
    login(client, "eng@egsa.local")
    cookie = client.cookies.get(COOKIE)

    res = client.post("/api/v1/auth/logout")
    assert res.status_code == 204
    assert "auth.logout" in actions(db)

    client.cookies.set(COOKIE, cookie, path="/api/v1/auth")
    assert client.post("/api/v1/auth/refresh").status_code == 401


# ── Forced password change (D9) ───────────────────────────


def _add_protected_route(app):
    @app.get("/api/v1/_test/protected")
    def protected(user: CurrentUser) -> dict[str, str]:
        return {"email": user.email}

    @app.get("/api/v1/_test/admin-only")
    def admin_only(
        user: Annotated[User, Depends(require_permission(PermissionCode.USERS_CREATE))],
    ) -> dict[str, str]:
        return {"email": user.email}


def test_must_change_password_blocks_everything_but_me_and_password_change(
    app, client: TestClient, make_user
):
    _add_protected_route(app)
    make_user("new@egsa.local", must_change_password=True)
    body = login(client, "new@egsa.local").json()
    token = body["access_token"]
    assert body["user"]["must_change_password"] is True

    assert client.get("/api/v1/auth/me", headers=auth_header(token)).status_code == 200
    blocked = client.get("/api/v1/_test/protected", headers=auth_header(token))
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "PASSWORD_CHANGE_REQUIRED"

    res = client.post(
        "/api/v1/me/password",
        headers=auth_header(token),
        json={"current_password": DEFAULT_PASSWORD, "new_password": "A-brand-new-pass-1"},
    )
    assert res.status_code == 200
    new_token = res.json()["access_token"]
    assert res.json()["user"]["must_change_password"] is False
    assert client.get("/api/v1/_test/protected", headers=auth_header(new_token)).status_code == 200
    assert login(client, "new@egsa.local", "A-brand-new-pass-1").status_code == 200


def test_change_password_validation(client, make_user):
    make_user("eng@egsa.local")
    token = login(client, "eng@egsa.local").json()["access_token"]

    def change(current: str, new: str):
        return client.post(
            "/api/v1/me/password",
            headers=auth_header(token),
            json={"current_password": current, "new_password": new},
        )

    assert change("wrong", "A-brand-new-pass-1").json()["error"]["code"] == (
        "INVALID_CURRENT_PASSWORD"
    )
    assert change(DEFAULT_PASSWORD, "short").json()["error"]["code"] == "PASSWORD_TOO_SHORT"
    assert change(DEFAULT_PASSWORD, DEFAULT_PASSWORD).json()["error"]["code"] == (
        "PASSWORD_UNCHANGED"
    )


def test_password_change_ends_other_sessions(client, app, make_user):
    make_user("eng@egsa.local")
    other_device = TestClient(app)
    login(other_device, "eng@egsa.local")
    token = login(client, "eng@egsa.local").json()["access_token"]

    client.post(
        "/api/v1/me/password",
        headers=auth_header(token),
        json={"current_password": DEFAULT_PASSWORD, "new_password": "A-brand-new-pass-1"},
    )
    assert other_device.post("/api/v1/auth/refresh").status_code == 401
    assert client.post("/api/v1/auth/refresh").status_code == 200


def test_arabic_and_long_passwords_work(client, make_user):
    password = "كلمة-مرور-طويلة-جدا-" * 5  # > 72 bytes in UTF-8 (bcrypt's raw limit)
    make_user("ar@egsa.local", password=password)
    assert login(client, "ar@egsa.local", password).status_code == 200
    assert login(client, "ar@egsa.local", password[:-1]).status_code == 401


# ── Permissions ───────────────────────────────────────────


def test_require_permission(app, client, make_user):
    _add_protected_route(app)
    make_user("admin@egsa.local", role="admin")
    make_user("eng@egsa.local", role="engineer")

    admin_token = login(client, "admin@egsa.local").json()["access_token"]
    eng_token = login(client, "eng@egsa.local").json()["access_token"]

    assert (
        client.get("/api/v1/_test/admin-only", headers=auth_header(admin_token)).status_code == 200
    )
    res = client.get("/api/v1/_test/admin-only", headers=auth_header(eng_token))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"


def test_replaying_a_logged_out_token_does_not_end_other_sessions(client, app, make_user):
    make_user("eng@egsa.local")
    laptop = TestClient(app)
    login(laptop, "eng@egsa.local")
    login(client, "eng@egsa.local")
    old = client.cookies.get(COOKIE)
    client.post("/api/v1/auth/logout")

    client.cookies.set(COOKIE, old, path="/api/v1/auth")
    assert client.post("/api/v1/auth/refresh").status_code == 401
    assert laptop.post("/api/v1/auth/refresh").status_code == 200  # untouched
