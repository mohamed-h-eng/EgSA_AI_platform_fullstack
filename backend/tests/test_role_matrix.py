"""Phase 10 permission matrix: each role × each endpoint → expected status (plan §44).

Everyone below is a member of project P in the matching project role (lead / engineer /
viewer); project Q has no members, so only the admin can see it. Document D in P was
uploaded by someone else, so only the admin and P's lead may edit or delete it.
The users-admin endpoints have their own matrix in test_users.py.
"""

from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient

from tests.conftest import auth_header, login
from tests.files import pdf_bytes

API = "/api/v1"
ROLES = ("admin", "project_lead", "engineer", "viewer")


@dataclass
class World:
    headers: dict[str, dict[str, str]]
    ids: dict[str, str]


@pytest.fixture
def world(client: TestClient, make_user) -> World:
    headers = {}
    users = {}
    for role in ROLES:
        users[role] = make_user(f"{role}@egsa.local", role=role)
        headers[role] = auth_header(login(client, f"{role}@egsa.local").json()["access_token"])
    uploader = make_user("uploader@egsa.local", role="engineer")
    outsider = make_user("outsider@egsa.local", role="engineer")
    admin = headers["admin"]

    def project(code: str) -> str:
        return client.post(
            f"{API}/projects", headers=admin, json={"code": code, "name": code}
        ).json()["id"]

    p, q = project("P-1"), project("Q-1")
    for user, role in [
        (users["project_lead"], "lead"),
        (users["engineer"], "engineer"),
        (users["viewer"], "viewer"),
        (uploader, "engineer"),
    ]:
        client.post(
            f"{API}/projects/{p}/members",
            headers=admin,
            json={"user_id": str(user.id), "project_role": role},
        )

    uploader_h = auth_header(login(client, "uploader@egsa.local").json()["access_token"])

    def document(project_id: str, code: str, headers) -> str:
        res = client.post(
            f"{API}/documents",
            headers=headers,
            data={"project_id": project_id, "code": code, "title": code},
            files={"file": (f"{code}.pdf", pdf_bytes())},
        )
        assert res.status_code == 201, res.text
        return res.json()["id"]

    ids = {
        "P": p,
        "Q": q,
        "D": document(p, "D-1", uploader_h),
        "DQ": document(q, "DQ-1", admin),
        "outsider": str(outsider.id),
    }
    return World(headers, ids)


def expect(admin: int, lead: int, engineer: int, viewer: int) -> dict[str, int]:
    return {"admin": admin, "project_lead": lead, "engineer": engineer, "viewer": viewer}


ALL_OK = expect(200, 200, 200, 200)
ADMIN_ONLY = expect(200, 403, 403, 403)
ADMIN_SEES_ONLY = expect(200, 404, 404, 404)

CASES = [
    # Dashboard, profile, AI
    ("GET", "/dashboard/summary", None, ALL_OK),
    ("GET", "/me", None, ALL_OK),
    ("GET", "/ai/models", None, ALL_OK),
    # Admin
    ("GET", "/admin/settings", None, ADMIN_ONLY),
    ("GET", "/admin/audit-logs", None, ADMIN_ONLY),
    ("GET", "/admin/ai/config", None, ADMIN_ONLY),
    ("PUT", "/admin/settings", {"max_upload_mb": 5, "allowed_file_types": ["pdf"]}, ADMIN_ONLY),
    # Projects
    ("GET", "/projects", None, ALL_OK),
    ("GET", "/projects/{P}", None, ALL_OK),
    ("GET", "/projects/{Q}", None, ADMIN_SEES_ONLY),
    ("POST", "/projects", {"code": "NEW-1", "name": "New"}, expect(201, 201, 403, 403)),
    ("PATCH", "/projects/{P}", {"name": "Renamed"}, expect(200, 200, 403, 403)),
    # No projects:update at all → 403 before any lookup (nothing leaks); a lead can't see Q → 404.
    ("PATCH", "/projects/{Q}", {"name": "Renamed"}, expect(200, 404, 403, 403)),
    ("DELETE", "/projects/{P}", None, expect(204, 403, 403, 403)),
    ("GET", "/projects/{P}/members", None, ALL_OK),
    (
        "POST",
        "/projects/{P}/members",
        {"user_id": "{outsider}", "project_role": "viewer"},
        expect(201, 201, 403, 403),
    ),
    # Documents
    ("GET", "/documents", None, ALL_OK),
    ("GET", "/documents/{D}", None, ALL_OK),
    ("GET", "/documents/{DQ}", None, ADMIN_SEES_ONLY),
    ("GET", "/documents/{D}/download", None, ALL_OK),
    ("GET", "/documents/{DQ}/download", None, ADMIN_SEES_ONLY),
    ("PATCH", "/documents/{D}", {"title": "Changed"}, expect(200, 200, 403, 403)),
    ("DELETE", "/documents/{D}", None, expect(204, 204, 403, 403)),
    ("DELETE", "/documents/{DQ}", None, expect(204, 404, 404, 404)),
    # Chat (every role chats, D10)
    ("POST", "/conversations", {}, expect(201, 201, 201, 201)),
    ("POST", "/conversations", {"project_id": "{P}"}, expect(201, 201, 201, 201)),
    ("POST", "/conversations", {"project_id": "{Q}"}, expect(201, 404, 404, 404)),
    ("GET", "/conversations", None, ALL_OK),
]


def fill(value, ids: dict[str, str]):
    if isinstance(value, str):
        return value.format(**ids)
    if isinstance(value, dict):
        return {k: fill(v, ids) for k, v in value.items()}
    return value


@pytest.mark.parametrize("role", ROLES)
@pytest.mark.parametrize(("method", "path", "body", "expected"), CASES)
def test_role_matrix(client, world, role, method, path, body, expected):
    res = client.request(
        method,
        API + fill(path, world.ids),
        headers=world.headers[role],
        json=fill(body, world.ids),
    )
    assert res.status_code == expected[role], f"{role} {method} {path}: {res.text[:300]}"


@pytest.mark.parametrize(
    ("role", "project", "expected"),
    [
        ("admin", "Q", 201),
        ("project_lead", "P", 201),
        ("engineer", "P", 201),
        ("viewer", "P", 403),
        ("engineer", "Q", 404),
    ],
)
def test_upload_matrix(client, world, role, project, expected):
    res = client.post(
        f"{API}/documents",
        headers=world.headers[role],
        data={"project_id": world.ids[project], "code": "UP-1", "title": "Up"},
        files={"file": ("up.pdf", pdf_bytes())},
    )
    assert res.status_code == expected, res.text[:300]
