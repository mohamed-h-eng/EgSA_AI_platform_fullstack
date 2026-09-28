"""Demo acceptance run (.agent/checklists/demo-acceptance.md) against a running stack, via the API.

Standard library only. Every run uses fresh names, so it can run twice in a row (the pass
criterion). The UI-only parts of the checklist (toasts, RTL rendering) are covered by the
frontend tests; everything the server decides is checked here.

    python scripts/demo_acceptance.py --base-url http://localhost --env-file .env

Admin and demo passwords come from the env file (SEED_ADMIN_*, SEED_DEMO_PASSWORD), so run it
on a stack seeded from that file. It never configures an AI key: if an admin has configured one
(D17), step 12 checks a real streamed answer; otherwise it checks the friendly "not configured"
error, a saved history and Retry (step 18).
"""

from __future__ import annotations

import argparse
import json
import secrets
import sys
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass, field
from pathlib import Path

PDF = (
    b"%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n% EPS requirements\n"
    b"trailer << /Root 1 0 R >>\n%%EOF\n"
)


class StepFailedError(AssertionError):
    pass


def check(condition: bool, message: str) -> None:
    if not condition:
        raise StepFailedError(message)


@dataclass
class Response:
    status: int
    body: object
    text: str
    headers: dict[str, str]


@dataclass
class Session:
    api: str
    token: str | None = None
    who: str = "anonymous"
    history: list[str] = field(default_factory=list)

    def request(
        self,
        method: str,
        path: str,
        *,
        json_body: object = None,
        data: bytes | None = None,
        content_type: str | None = None,
        accept: str = "application/json",
    ) -> Response:
        headers = {"Accept": accept}
        if json_body is not None:
            data = json.dumps(json_body).encode()
            content_type = "application/json"
        if content_type:
            headers["Content-Type"] = content_type
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        req = urllib.request.Request(self.api + path, method=method, data=data, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                status, raw, hdrs = res.status, res.read(), dict(res.headers)
        except urllib.error.HTTPError as err:
            status, raw, hdrs = err.code, err.read(), dict(err.headers)
        text = raw.decode("utf-8", errors="replace")
        try:
            body = json.loads(text) if text and "json" in hdrs.get("Content-Type", "") else None
        except json.JSONDecodeError:
            body = None
        return Response(status, body, text, hdrs)

    def ok(self, method: str, path: str, expected: int = 200, **kwargs) -> Response:
        res = self.request(method, path, **kwargs)
        check(
            res.status == expected,
            f"{self.who}: {method} {path} → {res.status} (expected {expected}): {res.text[:300]}",
        )
        return res


def login(api: str, email: str, password: str) -> Session:
    session = Session(api, who=email)
    res = session.ok("POST", "/auth/login", json_body={"email": email, "password": password})
    session.token = res.body["access_token"]
    session.user = res.body["user"]  # type: ignore[attr-defined]
    return session


def multipart(fields: dict[str, str], filename: str, content: bytes) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    parts = [
        f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
        for k, v in fields.items()
    ]
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: application/octet-stream\r\n\r\n".encode()
        + content
        + f"\r\n--{boundary}--\r\n".encode()
    )
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def sse_events(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.replace("\r\n", "\n").split("\n\n"):
        name, data = "message", []
        for line in block.split("\n"):
            if line.startswith("event:"):
                name = line[6:].strip()
            elif line.startswith("data:"):
                data.append(line[5:].lstrip())
        if data:
            events.append((name, json.loads("\n".join(data))))
    return events


def read_env(path: Path) -> dict[str, str]:
    env = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


# ── The story ─────────────────────────────────────────────


def run(api: str, env: dict[str, str]) -> list[str]:
    done: list[str] = []
    step = done.append
    run_id = time.strftime("%H%M%S") + secrets.token_hex(2)
    admin = login(api, env["SEED_ADMIN_EMAIL"], env["SEED_ADMIN_PASSWORD"])

    # A. Admin story
    summary = admin.ok("GET", "/dashboard/summary").body
    check(summary["admin"] is not None, "admin dashboard has no admin block")
    step("1  admin logs in; dashboard shows admin stats")

    projects = {p["code"]: p for p in admin.ok("GET", "/projects?page_size=100").body["items"]}
    check({"NEXSAT-1", "SAR"} <= projects.keys(), f"demo projects missing: {sorted(projects)}")
    nexsat, sar = projects["NEXSAT-1"], projects["SAR"]

    email = f"mohamed.e2e-{run_id}@egsa.local"
    created = admin.ok(
        "POST",
        "/users",
        201,
        json_body={
            "email": email,
            "full_name": "Mohamed Hany",
            "job_title": "Data Scientist",
            "role": "viewer",
        },
    ).body
    temp_password, user_id = created["temporary_password"], created["user"]["id"]
    check(created["user"]["must_change_password"], "new user is not forced to change password")
    step("2  create user with a one-time temporary password")

    admin.ok("PUT", f"/users/{user_id}/role", json_body={"role": "engineer"})
    step("3  assign role Engineer")

    admin.ok(
        "POST",
        f"/projects/{nexsat['id']}/members",
        201,
        json_body={"user_id": user_id, "project_role": "engineer"},
    )
    step("4  give NEXSAT-1 access")

    ai = admin.ok("GET", "/admin/ai/config").body
    ai_live = bool(ai["configured"])
    step(f"5  AI settings readable (configured: {ai_live})")

    # B. Engineer story
    engineer = login(api, email, temp_password)
    blocked = engineer.request("GET", "/projects")
    check(blocked.status == 403, f"temp password not forced to change ({blocked.status})")
    new_password = f"E2e-{secrets.token_urlsafe(12)}"
    engineer.token = engineer.ok(
        "POST",
        "/me/password",
        json_body={"current_password": temp_password, "new_password": new_password},
    ).body["access_token"]
    counts = engineer.ok("GET", "/dashboard/summary").body["counts"]
    check(counts["projects"] == 1, f"engineer dashboard counts {counts}")
    step("7  forced password change, then a scoped dashboard")

    visible = [p["code"] for p in engineer.ok("GET", "/projects").body["items"]]
    check(visible == ["NEXSAT-1"], f"engineer sees {visible}")
    engineer.ok("GET", f"/projects/{sar['id']}", 404)
    step("8  only NEXSAT-1 visible; SAR by URL → 404")

    code = f"EPS-SRS-E2E-{run_id}"
    body, ctype = multipart(
        {
            "project_id": nexsat["id"],
            "code": code,
            "title": "EPS Requirements (E2E)",
            "category": "requirements",
        },
        "EPS-SRS-001.pdf",
        PDF,
    )
    doc = engineer.ok("POST", "/documents", 201, data=body, content_type=ctype).body
    step("9  upload EPS-SRS-001.pdf to NEXSAT-1")

    download = engineer.ok("GET", f"/documents/{doc['id']}/download", accept="*/*")
    check(download.text.startswith("%PDF-"), "download did not return the PDF")
    found = engineer.ok("GET", f"/documents?q={code}&category=requirements").body["items"]
    check([d["id"] for d in found] == [doc["id"]], "search/category filter did not find it")
    step("10 download + search + category filter")

    body, ctype = multipart(
        {"project_id": nexsat["id"], "code": f"X-{run_id}", "title": "bad"}, "tool.exe", b"MZ"
    )
    bad = engineer.request("POST", "/documents", data=body, content_type=ctype)
    check(
        bad.status == 400 and bad.body["error"]["code"] == "FILE_TYPE_NOT_ALLOWED",
        f".exe not rejected: {bad.status} {bad.text[:200]}",
    )
    body, ctype = multipart(
        {"project_id": nexsat["id"], "code": f"Y-{run_id}", "title": "fake"}, "fake.pdf", b"MZ..."
    )
    spoofed = engineer.request("POST", "/documents", data=body, content_type=ctype)
    check(
        spoofed.status == 400 and spoofed.body["error"]["code"] == "FILE_CONTENT_MISMATCH",
        "spoofed PDF not rejected",
    )
    step("11 .exe and spoofed files rejected with clear errors")

    conversation = engineer.ok(
        "POST", "/conversations", 201, json_body={"project_id": nexsat["id"]}
    ).body
    stream = engineer.ok(
        "POST",
        f"/conversations/{conversation['id']}/messages/stream",
        json_body={"content": "What are typical battery undervoltage requirements?"},
        accept="text/event-stream",
    )
    events = sse_events(stream.text)
    names = [name for name, _ in events]
    check(names[:1] == ["start"], f"stream did not start: {names}")
    final = events[-1][1]["assistant_message"]
    if ai_live:
        check("delta" in names and names[-1] == "done", f"no streamed answer: {names}")
        check(final["status"] == "complete" and final["content"], "empty AI answer")
        arabic = engineer.ok(
            "POST",
            f"/conversations/{conversation['id']}/messages",
            201,
            json_body={"content": "اشرح ذلك باختصار باللغة العربية"},
        ).body
        check(arabic["user_message"]["content"] == "اشرح ذلك باختصار باللغة العربية", "Arabic lost")
        step("12 streamed AI answer + Arabic follow-up")
    else:
        check(names[-1] == "error", f"expected a friendly error event: {names}")
        check(final["error_code"] == "AI_NOT_CONFIGURED", f"unexpected error {final['error_code']}")
        retry = engineer.request("POST", f"/conversations/{conversation['id']}/retry", json_body={})
        check(retry.status in (200, 201), f"retry failed: {retry.status}")
        step("12/18 no AI key: friendly error saved, Retry works (live answer needs a key)")

    history = engineer.ok("GET", f"/conversations/{conversation['id']}/messages").body
    check(
        history[0]["content"] == "What are typical battery undervoltage requirements?",
        "history not saved",
    )
    engineer.ok(
        "PATCH", f"/conversations/{conversation['id']}", json_body={"title": "EPS undervoltage"}
    )
    listed = engineer.ok("GET", "/conversations").body["items"]
    check(listed[0]["title"] == "EPS undervoltage", "rename not saved / not most recent")
    step("13 history persists; rename works")

    # C. Viewer story
    viewer = login(api, "sara.viewer@egsa.local", env["SEED_DEMO_PASSWORD"])
    viewer.ok("GET", f"/documents/{doc['id']}/download", accept="*/*")
    doc_view = viewer.ok("GET", f"/documents/{doc['id']}").body
    check(not doc_view["abilities"]["can_delete"], "viewer can delete")
    body, ctype = multipart(
        {"project_id": nexsat["id"], "code": f"V-{run_id}", "title": "v"}, "v.pdf", PDF
    )
    viewer.ok("POST", "/documents", 403, data=body, content_type=ctype)
    step("15 viewer reads/downloads; upload → 403")

    # D. Admin verification
    actions = {
        e["action"] for e in admin.ok("GET", "/admin/audit-logs?page_size=100").body["items"]
    }
    wanted = {
        "auth.login",
        "user.create",
        "user.role_change",
        "project.member_add",
        "document.upload",
        "document.download",
        "ai.request",
    }
    check(wanted <= actions, f"audit log missing {sorted(wanted - actions)}")
    step("16 audit log shows the story")

    usage = admin.ok("GET", "/dashboard/summary").body["admin"]["ai_usage_7d"]
    mine = [u for u in usage if u["user"] and u["user"]["email"] == email]
    check(mine and mine[0]["requests"] >= 1, "engineer's AI usage not shown")
    admin.ok("POST", f"/users/{user_id}/disable")
    check(engineer.request("GET", "/dashboard/summary").status == 401, "disabled user kept access")
    relogin = Session(api).request(
        "POST", "/auth/login", json_body={"email": email, "password": new_password}
    )
    check(
        relogin.status == 403 and relogin.body["error"]["code"] == "ACCOUNT_DISABLED",
        f"disabled user was not refused: {relogin.status} {relogin.text[:200]}",
    )
    step("17 AI usage per user shown; disabling cuts access")

    # Keep repeated runs tidy: remove the uploaded test document.
    admin.ok("DELETE", f"/documents/{doc['id']}", 204)
    return done


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--base-url", default="http://localhost")
    parser.add_argument("--env-file", default=".env", type=Path)
    args = parser.parse_args()
    api = args.base_url.rstrip("/") + "/api/v1"
    env = read_env(args.env_file)
    try:
        steps = run(api, env)
    except StepFailedError as failure:
        print(f"FAIL: {failure}")
        return 1
    for s in steps:
        print(f"  ok  {s}")
    print(f"PASS: {len(steps)} checks against {api}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
