from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.models.audit import AuditLog
from app.models.document import Document
from tests.files import docx_bytes, pdf_bytes, txt_bytes, zip_without_word_bytes

API = "/api/v1"


def upload(
    client: TestClient,
    headers,
    project_id: str,
    *,
    filename: str = "EPS-SRS-001.pdf",
    content: bytes | None = None,
    **fields,
):
    data = {"project_id": project_id, "code": "EPS-SRS-001", "title": "EPS Requirements"} | fields
    return client.post(
        f"{API}/documents",
        headers=headers,
        data=data,
        files={"file": (filename, pdf_bytes() if content is None else content)},
    )


def error_code(res) -> str:
    return res.json()["error"]["code"]


def audit_actions(db) -> list[str]:
    db.expire_all()
    return [a.action for a in db.scalars(select(AuditLog))]


# ── Upload ────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("filename", "content", "file_type"),
    [
        ("EPS-SRS-001.pdf", pdf_bytes(), "pdf"),
        ("design notes.docx", docx_bytes(), "docx"),
        ("battery-notes.TXT", txt_bytes(), "txt"),
    ],
)
def test_engineer_uploads_supported_types(client, lib, storage, db, filename, content, file_type):
    res = upload(
        client,
        lib["h"]["mohamed"],
        lib["nexsat"],
        filename=filename,
        content=content,
        code="eps-srs-001",
        category="requirements",
        revision="C",
        status="approved",
        description="Battery undervoltage requirements",
    )
    assert res.status_code == 201, res.text
    doc = res.json()
    assert doc["code"] == "EPS-SRS-001"  # normalized
    assert doc["file_type"] == file_type
    assert doc["size_bytes"] == len(content)
    assert doc["category"] == {"code": "requirements", "name": "Requirements"}
    assert doc["project"]["code"] == "NEXSAT-1"
    assert doc["uploaded_by"]["full_name"] == "Mohamed"
    assert doc["abilities"] == {"can_edit": True, "can_delete": True}

    row = db.scalar(select(Document))
    assert row.original_filename == filename
    assert row.storage_key != filename and storage.exists(row.storage_key)
    assert "document.upload" in audit_actions(db)


@pytest.mark.parametrize(
    ("filename", "content", "code"),
    [
        ("malware.exe", b"MZ\x90\x00", "FILE_TYPE_NOT_ALLOWED"),
        ("no-extension", pdf_bytes(), "FILE_TYPE_NOT_ALLOWED"),
        ("renamed.pdf", b"MZ\x90\x00 definitely not a pdf", "FILE_CONTENT_MISMATCH"),
        ("fake.docx", zip_without_word_bytes(), "FILE_CONTENT_MISMATCH"),
        ("fake.docx", pdf_bytes(), "FILE_CONTENT_MISMATCH"),
        ("binary.txt", b"hello\x00world", "FILE_CONTENT_MISMATCH"),
        ("latin1.txt", "caf\xe9".encode("latin-1"), "FILE_CONTENT_MISMATCH"),
        ("empty.pdf", b"", "FILE_EMPTY"),
    ],
)
def test_rejected_files_never_reach_storage(client, lib, storage, filename, content, code):
    res = upload(client, lib["h"]["mohamed"], lib["nexsat"], filename=filename, content=content)
    assert res.status_code == 400, res.text
    assert error_code(res) == code
    assert list(storage.base.iterdir()) == []


def test_oversize_file_is_rejected(client, lib, storage, monkeypatch):
    monkeypatch.setattr(get_settings(), "max_upload_mb", 1)
    big = pdf_bytes() + b"0" * (1024 * 1024)
    res = upload(client, lib["h"]["mohamed"], lib["nexsat"], content=big)
    assert res.status_code == 400
    assert error_code(res) == "FILE_TOO_LARGE"
    assert res.json()["error"]["details"]["max_bytes"] == 1024 * 1024
    assert list(storage.base.iterdir()) == []


def test_upload_permissions(client, lib):
    h = lib["h"]
    # Viewer role (global) lacks documents:upload.
    assert upload(client, h["sara"], lib["nexsat"]).status_code == 403
    # Not a member of SAR → the project doesn't exist for Mohamed.
    res = upload(client, h["mohamed"], lib["sar"])
    assert res.status_code == 404 and error_code(res) == "PROJECT_NOT_FOUND"
    # Admin can upload anywhere.
    assert upload(client, h["admin"], lib["sar"]).status_code == 201


def test_project_viewer_with_engineer_global_role_cannot_upload(client, lib):
    """Effective = global permission AND project role: a project Viewer is read-only."""
    h, u = lib["h"], lib["u"]
    client.patch(
        f"{API}/projects/{lib['nexsat']}/members/{u['omar'].id}",
        headers=h["admin"],
        json={"project_role": "viewer"},
    )
    assert upload(client, h["omar"], lib["nexsat"]).status_code == 403


def test_document_code_is_unique_per_project(client, lib):
    h = lib["h"]
    assert upload(client, h["mohamed"], lib["nexsat"]).status_code == 201
    dup = upload(client, h["ahmed"], lib["nexsat"], code="eps-srs-001")
    assert dup.status_code == 409 and error_code(dup) == "DOCUMENT_CODE_EXISTS"
    assert "NEXSAT-1" in dup.json()["error"]["message"]
    # Same code in another project is fine (D14).
    assert upload(client, h["hussein"], lib["sar"]).status_code == 201


def test_metadata_validation(client, lib):
    h = lib["h"]
    bad_code = upload(client, h["mohamed"], lib["nexsat"], code="has space")
    assert bad_code.status_code == 422
    assert bad_code.json()["error"]["details"]["errors"][0]["loc"] == ["body", "code"]
    assert upload(client, h["mohamed"], lib["nexsat"], title="  ").status_code == 422
    unknown = upload(client, h["mohamed"], lib["nexsat"], category="secret-stuff")
    assert error_code(unknown) == "UNKNOWN_CATEGORY"


@pytest.mark.parametrize(
    "filename", ["../../etc/passwd.pdf", "..\\..\\windows\\passwd.pdf", "/abs/passwd.pdf"]
)
def test_uploaded_filename_keeps_only_the_basename(client, lib, filename):
    res = upload(client, lib["h"]["mohamed"], lib["nexsat"], filename=filename)
    assert res.status_code == 201
    assert res.json()["original_filename"] == "passwd.pdf"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("pass\x07wd.pdf", "passwd.pdf"),  # control characters stripped
        ("  spaced\tname  .pdf", "spaced name .pdf"),
        ("", "document.pdf"),
        ("...", "document.pdf"),
        ("تقرير البطارية.pdf", "تقرير البطارية.pdf"),  # Arabic kept (D3)
    ],
)
def test_sanitize_filename(raw, expected):
    from app.models.document import FileType
    from app.services.documents.validation import sanitize_filename

    assert sanitize_filename(raw, FileType.PDF) == expected


# ── List, search, filter ──────────────────────────────────


def test_list_is_scoped_to_visible_projects(client, lib):
    h = lib["h"]
    upload(client, h["mohamed"], lib["nexsat"], code="EPS-SRS-001")
    upload(client, h["hussein"], lib["sar"], code="SAR-FS-001", title="SAR feasibility")

    def codes(who, **params):
        res = client.get(f"{API}/documents", headers=h[who], params=params)
        assert res.status_code == 200, res.text
        return sorted(d["code"] for d in res.json()["items"])

    assert codes("admin") == ["EPS-SRS-001", "SAR-FS-001"]
    assert codes("mohamed") == ["EPS-SRS-001"]
    assert codes("sara") == ["EPS-SRS-001"]  # viewers can read
    assert codes("hussein") == ["SAR-FS-001"]
    # Asking for another project's documents explicitly still returns nothing.
    assert codes("mohamed", project_id=lib["sar"]) == []


def test_search_and_filters(client, lib):
    h = lib["h"]
    upload(
        client,
        h["mohamed"],
        lib["nexsat"],
        code="EPS-SRS-001",
        title="EPS Requirements",
        category="requirements",
        status="approved",
    )
    upload(
        client,
        h["mohamed"],
        lib["nexsat"],
        code="EPS-TR-002",
        title="Battery test report",
        category="test",
        filename="report.txt",
        content=txt_bytes(),
    )
    upload(
        client,
        h["mohamed"],
        lib["nexsat"],
        code="EPS-AR-003",
        title="تقرير البطارية",
        filename="ar.docx",
        content=docx_bytes(),
    )

    def codes(**params):
        return sorted(
            d["code"]
            for d in client.get(f"{API}/documents", headers=h["mohamed"], params=params).json()[
                "items"
            ]
        )

    assert codes(q="battery") == ["EPS-TR-002"]
    assert codes(q="srs") == ["EPS-SRS-001"]
    assert codes(q="البطارية") == ["EPS-AR-003"]  # Arabic titles (D3)
    assert codes(category="test") == ["EPS-TR-002"]
    assert codes(type="docx") == ["EPS-AR-003"]
    assert codes(status="approved") == ["EPS-SRS-001"]
    assert codes(q="%") == []


def test_documents_of_deleted_project_disappear(client, lib, storage):
    h = lib["h"]
    doc_id = upload(client, h["mohamed"], lib["nexsat"]).json()["id"]
    client.delete(f"{API}/projects/{lib['nexsat']}", headers=h["admin"])
    assert client.get(f"{API}/documents", headers=h["admin"]).json()["total"] == 0
    assert client.get(f"{API}/documents/{doc_id}", headers=h["admin"]).status_code == 404
    # Soft delete: the file itself is kept for recovery.
    assert len(list(storage.base.iterdir())) == 1


def test_project_document_count(client, lib):
    upload(client, lib["h"]["mohamed"], lib["nexsat"])
    project = client.get(f"{API}/projects/{lib['nexsat']}", headers=lib["h"]["mohamed"]).json()
    assert project["document_count"] == 1
    listed = client.get(f"{API}/projects", headers=lib["h"]["mohamed"]).json()["items"][0]
    assert listed["document_count"] == 1


# ── Download ──────────────────────────────────────────────


def test_download_streams_the_original_bytes(client, lib, db):
    content = txt_bytes()
    doc_id = upload(
        client, lib["h"]["mohamed"], lib["nexsat"], filename="ملاحظات البطارية.txt", content=content
    ).json()["id"]

    res = client.get(f"{API}/documents/{doc_id}/download", headers=lib["h"]["sara"])
    assert res.status_code == 200
    assert res.content == content
    assert res.headers["content-type"].startswith("text/plain")
    assert res.headers["x-content-type-options"] == "nosniff"
    disposition = res.headers["content-disposition"]
    assert disposition.startswith("attachment;")
    assert f"filename*=UTF-8''{quote('ملاحظات البطارية.txt')}" in disposition
    assert "document.download" in audit_actions(db)


def test_inline_view_only_for_safe_types(client, lib):
    h = lib["h"]
    pdf = upload(client, h["mohamed"], lib["nexsat"]).json()["id"]
    docx = upload(
        client, h["mohamed"], lib["nexsat"], code="D-2", filename="d.docx", content=docx_bytes()
    ).json()["id"]
    pdf_res = client.get(f"{API}/documents/{pdf}/download?inline=true", headers=h["mohamed"])
    assert pdf_res.headers["content-disposition"].startswith("inline;")
    docx_res = client.get(f"{API}/documents/{docx}/download?inline=true", headers=h["mohamed"])
    assert docx_res.headers["content-disposition"].startswith("attachment;")


def test_non_member_cannot_download(client, lib):
    doc_id = upload(client, lib["h"]["hussein"], lib["sar"]).json()["id"]
    res = client.get(f"{API}/documents/{doc_id}/download", headers=lib["h"]["mohamed"])
    assert res.status_code == 404


def test_missing_file_is_reported_cleanly(client, lib, storage, db):
    doc_id = upload(client, lib["h"]["mohamed"], lib["nexsat"]).json()["id"]
    storage.delete(db.scalar(select(Document)).storage_key)
    res = client.get(f"{API}/documents/{doc_id}/download", headers=lib["h"]["mohamed"])
    assert res.status_code == 404 and error_code(res) == "DOCUMENT_FILE_MISSING"


# ── Update ────────────────────────────────────────────────


def test_edit_permissions(client, lib):
    h = lib["h"]
    doc_id = upload(client, h["mohamed"], lib["nexsat"]).json()["id"]
    url = f"{API}/documents/{doc_id}"

    ok = client.patch(url, headers=h["mohamed"], json={"status": "pending_review", "revision": "D"})
    assert ok.status_code == 200
    assert ok.json()["status"] == "pending_review" and ok.json()["revision"] == "D"
    assert client.patch(url, headers=h["ahmed"], json={"title": "By the lead"}).status_code == 200
    assert client.patch(url, headers=h["omar"], json={"title": "x"}).status_code == 403
    assert client.patch(url, headers=h["sara"], json={"title": "x"}).status_code == 403
    assert client.patch(url, headers=h["hussein"], json={"title": "x"}).status_code == 404

    abilities = client.get(url, headers=h["omar"]).json()["abilities"]
    assert abilities == {"can_edit": False, "can_delete": False}


def test_edit_validation(client, lib):
    h = lib["h"]
    upload(client, h["mohamed"], lib["nexsat"], code="A-1")
    doc_id = upload(client, h["mohamed"], lib["nexsat"], code="B-1").json()["id"]
    url = f"{API}/documents/{doc_id}"
    assert error_code(client.patch(url, headers=h["mohamed"], json={"code": "a-1"})) == (
        "DOCUMENT_CODE_EXISTS"
    )
    assert (
        client.patch(url, headers=h["mohamed"], json={"category": None}).json()["category"] is None
    )
    assert (
        client.patch(url, headers=h["mohamed"], json={"category": "design"}).json()["category"][
            "code"
        ]
        == "design"
    )


# ── Delete ────────────────────────────────────────────────


def test_delete_permissions_and_file_removal(client, lib, storage, db):
    h = lib["h"]
    mine = upload(client, h["mohamed"], lib["nexsat"], code="M-1").json()["id"]
    theirs = upload(client, h["omar"], lib["nexsat"], code="O-1").json()["id"]

    assert client.delete(f"{API}/documents/{theirs}", headers=h["mohamed"]).status_code == 403
    assert client.delete(f"{API}/documents/{mine}", headers=h["sara"]).status_code == 403
    assert client.delete(f"{API}/documents/{mine}", headers=h["mohamed"]).status_code == 204
    assert client.delete(f"{API}/documents/{theirs}", headers=h["ahmed"]).status_code == 204  # lead

    db.expire_all()
    assert db.scalar(select(Document)) is None
    assert list(storage.base.iterdir()) == []  # files are really gone (hard delete, D16)
    assert audit_actions(db).count("document.delete") == 2


def test_categories_and_upload_config(client, lib):
    cats = client.get(f"{API}/documents/categories", headers=lib["h"]["sara"]).json()
    assert [c["code"] for c in cats][:3] == ["requirements", "design", "test"]
    config = client.get(f"{API}/documents/upload-config", headers=lib["h"]["sara"]).json()
    assert config == {"max_upload_bytes": 50 * 1024 * 1024, "allowed_types": ["pdf", "docx", "txt"]}
