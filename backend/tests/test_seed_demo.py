import io

from sqlalchemy import func, select

from app.core.config import get_settings
from app.database.seed import seed
from app.models.document import Document, FileType
from app.models.project import Project
from app.models.user import User
from app.services.documents.validation import receive_upload


def test_demo_seed_is_idempotent_and_matches_the_demo_story(db, storage, monkeypatch):
    monkeypatch.setattr(get_settings(), "seed_demo_password", "Demo-Password-1")
    seed(db, demo=True, storage=storage)
    seed(db, demo=True, storage=storage)

    assert db.scalar(select(func.count()).select_from(Project)) == 3
    assert db.scalar(select(func.count()).select_from(User)) == 5  # admin + 4 demo users

    projects = {p.code: p for p in db.scalars(select(Project))}
    nexsat_members = {m.user.email: m.project_role for m in projects["NEXSAT-1"].members}
    assert nexsat_members == {
        "ahmed.lead@egsa.local": "lead",
        "mohamed.eng@egsa.local": "engineer",
        "sara.viewer@egsa.local": "viewer",
    }
    # Hussein is only on SAR: the "can't see other projects" demo.
    assert {m.user.email for m in projects["SAR"].members} == {"hussein.sar@egsa.local"}
    assert all(not u.must_change_password for u in db.scalars(select(User)))

    # Every project lead also holds the global Project Lead role, so they can manage it.
    for project in projects.values():
        for m in project.members:
            if m.project_role == "lead":
                assert m.user.role_codes == ["project_lead"], m.user.email


def test_demo_users_are_skipped_without_a_password(db, storage, monkeypatch):
    monkeypatch.setattr(get_settings(), "seed_demo_password", "")
    seed(db, demo=True, storage=storage)
    assert db.scalar(select(func.count()).select_from(User)) == 1  # only the admin
    assert db.scalar(select(func.count()).select_from(Project)) == 3  # projects without members


def test_demo_documents_are_real_valid_files(db, storage, monkeypatch):
    """Every seeded file must pass the same validation as a user upload."""
    monkeypatch.setattr(get_settings(), "seed_demo_password", "Demo-Password-1")
    seed(db, demo=True, storage=storage)
    seed(db, demo=True, storage=storage)  # idempotent

    documents = list(db.scalars(select(Document)))
    assert len(documents) == 9
    assert {d.file_type for d in documents} == {"pdf", "docx", "txt"}
    for document in documents:
        content = b"".join(storage.open_stream(document.storage_key))
        assert len(content) == document.size_bytes
        validated = receive_upload(
            io.BytesIO(content),
            document.original_filename,
            max_bytes=10 * 1024 * 1024,
            allowed_types=[t.value for t in FileType],
        )
        validated.close()


def test_demo_conversations_span_days_and_include_arabic(db, storage, monkeypatch):
    from app.models.conversation import Conversation

    monkeypatch.setattr(get_settings(), "seed_demo_password", "Demo-Password-1")
    seed(db, demo=True, storage=storage)
    seed(db, demo=True, storage=storage)  # idempotent

    conversations = list(db.scalars(select(Conversation)))
    assert len(conversations) == 6
    assert any("البطارية" in c.title for c in conversations)  # Arabic example (D3)
    days = {c.last_message_at.date() for c in conversations}
    assert len(days) >= 3  # spread over Today / Yesterday / earlier
    for c in conversations:
        assert [m.position for m in c.messages] == list(range(1, len(c.messages) + 1))
        assert all(m.model == "demo" for m in c.messages if m.role == "assistant")
