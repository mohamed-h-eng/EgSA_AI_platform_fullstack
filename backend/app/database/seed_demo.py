"""Realistic FAKE demo data (decision D12). Enabled with SEED_DEMO=true; idempotent.

Everything here is invented for demonstrations: no real EgSA data.
Later phases extend this module (documents in phase 05, conversations in phase 06).
"""

import hashlib
import io
import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.database.demo_files import make_demo_file
from app.models.conversation import Conversation, Message, MessageRole, MessageStatus
from app.models.document import Document, DocumentCategory, DocumentStatus, FileType
from app.models.project import Project, ProjectMember, ProjectRole, ProjectStatus
from app.models.role import Role
from app.models.user import User
from app.services.documents.validation import MIME_TYPES
from app.storage import StorageService

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class DemoUser:
    email: str
    full_name: str
    job_title: str
    role: str


@dataclass(frozen=True)
class DemoProject:
    code: str
    name: str
    subsystem: str | None
    status: ProjectStatus
    description: str
    members: tuple[tuple[str, ProjectRole], ...]  # (email, project role)


DEMO_USERS = (
    DemoUser("ahmed.lead@egsa.local", "Ahmed Abdelrahman", "EPS Project Lead", "project_lead"),
    DemoUser("mohamed.eng@egsa.local", "Mohamed Hany", "Data Scientist", "engineer"),
    DemoUser("sara.viewer@egsa.local", "Sara Mohamed", "Quality Assurance", "viewer"),
    # Leads SAR only: shows that project leads can't see other teams' projects.
    DemoUser("hussein.sar@egsa.local", "Hussein Saleh", "SAR Payload Lead", "project_lead"),
)

DEMO_PROJECTS = (
    DemoProject(
        code="NEXSAT-1",
        name="NEXSAT-1 Electrical Power System",
        subsystem="EPS",
        status=ProjectStatus.IN_DEVELOPMENT,
        description=(
            "Design and qualification of the electrical power system for the NEXSAT-1 "
            "small satellite: solar arrays, battery, and power distribution."
        ),
        members=(
            ("ahmed.lead@egsa.local", ProjectRole.LEAD),
            ("mohamed.eng@egsa.local", ProjectRole.ENGINEER),
            ("sara.viewer@egsa.local", ProjectRole.VIEWER),
        ),
    ),
    DemoProject(
        code="EGYPTSAT-2",
        name="EgyptSat-2 Operations",
        subsystem="Mission Operations",
        status=ProjectStatus.OPERATIONAL,
        description="In-orbit operations, anomaly reports and ground-segment procedures.",
        members=(("ahmed.lead@egsa.local", ProjectRole.LEAD),),
    ),
    DemoProject(
        code="SAR",
        name="SAR Payload Study",
        subsystem="Payload",
        status=ProjectStatus.PLANNING,
        description="Feasibility study for a synthetic aperture radar payload.",
        members=(("hussein.sar@egsa.local", ProjectRole.LEAD),),
    ),
)


@dataclass(frozen=True)
class DemoDocument:
    project: str
    code: str
    title: str
    category: str
    status: DocumentStatus
    revision: str | None
    file_type: FileType
    uploader: str
    body: str


def _doc(*args: object) -> DemoDocument:
    return DemoDocument(*args)  # type: ignore[arg-type]


DEMO_DOCUMENTS = (
    _doc(
        "NEXSAT-1",
        "EPS-SRS-001",
        "Electrical Power System Requirements Specification",
        "requirements",
        DocumentStatus.APPROVED,
        "C",
        FileType.PDF,
        "ahmed.lead@egsa.local",
        "REQ-EPS-010 The EPS shall provide 28 V +/- 1 V on the main bus.\n"
        "REQ-EPS-021 Battery undervoltage protection shall trip at 24.0 V.",
    ),
    _doc(
        "NEXSAT-1",
        "EPS-DD-002",
        "Battery Sizing Design Description",
        "design",
        DocumentStatus.PENDING_REVIEW,
        "A",
        FileType.DOCX,
        "mohamed.eng@egsa.local",
        "Depth of discharge limited to 30 % in eclipse.\nCapacity margin: 20 %.",
    ),
    _doc(
        "NEXSAT-1",
        "EPS-TP-003",
        "Solar Array Deployment Test Procedure",
        "test",
        DocumentStatus.DRAFT,
        None,
        FileType.TXT,
        "mohamed.eng@egsa.local",
        "Step 1: Verify hold-down release circuit continuity.\n"
        "Step 2: Command deployment and record hinge telemetry.",
    ),
    _doc(
        "NEXSAT-1",
        "EPS-TR-004",
        "Thermal Vacuum Test Report",
        "reports",
        DocumentStatus.APPROVED,
        "B",
        FileType.PDF,
        "ahmed.lead@egsa.local",
        "Eight thermal cycles completed between -20 C and +60 C.\nNo anomalies recorded.",
    ),
    _doc(
        "NEXSAT-1",
        "EPS-PR-005",
        "Battery Handling Procedure",
        "procedures",
        DocumentStatus.APPROVED,
        "A",
        FileType.DOCX,
        "ahmed.lead@egsa.local",
        "Store cells at 40-60 % state of charge.\nUse ESD protection at all times.",
    ),
    _doc(
        "EGYPTSAT-2",
        "OPS-AR-001",
        "Anomaly Report - Reaction Wheel Current Spike",
        "reports",
        DocumentStatus.PENDING_REVIEW,
        None,
        FileType.PDF,
        "ahmed.lead@egsa.local",
        "Observed a 0.4 A current spike on RW-2 during pass 1187.\nStatus: under analysis.",
    ),
    _doc(
        "EGYPTSAT-2",
        "OPS-PR-002",
        "Ground Station Pass Procedure",
        "procedures",
        DocumentStatus.APPROVED,
        "D",
        FileType.DOCX,
        "ahmed.lead@egsa.local",
        "AOS minus 10 min: configure antenna tracking.\nLOS: archive telemetry.",
    ),
    _doc(
        "SAR",
        "SAR-FS-001",
        "SAR Payload Feasibility Study",
        "reports",
        DocumentStatus.DRAFT,
        None,
        FileType.PDF,
        "hussein.sar@egsa.local",
        "Candidate band: C-band.\nPreliminary mass budget: 45 kg.",
    ),
    _doc(
        "SAR",
        "SAR-RQ-002",
        "Preliminary Payload Requirements",
        "requirements",
        DocumentStatus.DRAFT,
        None,
        FileType.TXT,
        "hussein.sar@egsa.local",
        "Ground resolution goal: 5 m.\nSwath width goal: 30 km.",
    ),
)


def seed_demo_documents(db: Session, storage: StorageService) -> None:
    projects = {p.code: p for p in db.scalars(select(Project))}
    categories = {c.code: c for c in db.scalars(select(DocumentCategory))}
    users = {u.email: u for u in db.scalars(select(User))}
    for demo in DEMO_DOCUMENTS:
        project = projects.get(demo.project)
        if project is None:
            continue
        exists = db.scalar(
            select(Document.id).where(Document.project_id == project.id, Document.code == demo.code)
        )
        if exists is not None:
            continue
        content = make_demo_file(demo.file_type, demo.title, demo.body)
        key = uuid.uuid4().hex
        storage.save(key, io.BytesIO(content))
        uploader = users.get(demo.uploader)
        db.add(
            Document(
                project_id=project.id,
                category_id=categories[demo.category].id,
                code=demo.code,
                title=demo.title,
                description=f"Demo {demo.category} document for {demo.project}.",
                revision=demo.revision,
                status=demo.status,
                file_type=demo.file_type,
                mime_type=MIME_TYPES[demo.file_type],
                size_bytes=len(content),
                sha256=hashlib.sha256(content).hexdigest(),
                storage_key=key,
                original_filename=f"{demo.code}.{demo.file_type}",
                uploaded_by_id=uploader.id if uploader else None,
            )
        )
        log.info("Created demo document %s/%s", demo.project, demo.code)
    db.flush()


@dataclass(frozen=True)
class DemoConversation:
    owner: str
    title: str
    project: str | None
    days_ago: float
    turns: tuple[tuple[str, str], ...]  # (user question, assistant answer)


# General engineering knowledge only: the AI must never appear to know EgSA documents (plan §24).
DEMO_CONVERSATIONS = (
    DemoConversation(
        "mohamed.eng@egsa.local",
        "Battery undervoltage protection",
        "NEXSAT-1",
        0.1,
        (
            (
                "What are typical undervoltage protection thresholds for a Li-ion "
                "satellite battery?",
                "Typical designs disconnect non-essential loads around 3.0-3.2 V per cell and "
                "trigger a full load shed near 2.8-3.0 V per cell. Exact values depend on the cell "
                "chemistry, temperature and the mission's depth-of-discharge policy.",
            ),
        ),
    ),
    DemoConversation(
        "mohamed.eng@egsa.local",
        "CAN bus timeout analysis",
        None,
        1.2,
        (
            (
                "How should I choose a CAN bus timeout for housekeeping telemetry?",
                "Start from the slowest expected message period and add margin for bus load and "
                "retransmissions, often 2-3x the nominal period, then validate it with bus-load "
                "measurements.",
            ),
        ),
    ),
    DemoConversation(
        "mohamed.eng@egsa.local",
        "شرح دورة شحن البطارية",
        None,
        5.0,
        (
            (
                "اشرح لي باختصار مراحل شحن بطارية الليثيوم أيون في القمر الصناعي",
                "عادةً تمر عملية الشحن بمرحلتين: تيار ثابت حتى الوصول إلى جهد الشحن، ثم جهد ثابت "
                "مع تناقص التيار تدريجياً. ويُراعى في الفضاء التحكم في درجة الحرارة وعمق التفريغ.",
            ),
        ),
    ),
    DemoConversation(
        "ahmed.lead@egsa.local",
        "EPS review checklist",
        "NEXSAT-1",
        0.3,
        (
            (
                "Draft a short checklist for an EPS design review.",
                "1. Power budget per mode with margins\n2. Battery sizing and DoD\n"
                "3. Solar array degradation (EOL)\n4. Fault protection and load shedding\n"
                "5. Grounding and EMC\n6. Test and verification plan",
            ),
        ),
    ),
    DemoConversation(
        "hussein.sar@egsa.local",
        "SAR resolution trade-offs",
        "SAR",
        2.5,
        (
            (
                "What drives the ground resolution of a spaceborne SAR?",
                "Range resolution is set mainly by the transmitted bandwidth, and azimuth "
                "resolution by the antenna length (about half the antenna length for stripmap), "
                "with trade-offs against swath width and data rate.",
            ),
        ),
    ),
    DemoConversation(
        "sara.viewer@egsa.local",
        "What is a thermal vacuum test?",
        None,
        8.0,
        (
            (
                "What is a thermal vacuum test and why is it done?",
                "It exposes hardware to vacuum and temperature cycles similar to orbit to verify "
                "performance and workmanship before launch.",
            ),
        ),
    ),
)


def seed_demo_conversations(db: Session) -> None:
    users = {u.email: u for u in db.scalars(select(User))}
    projects = {p.code: p for p in db.scalars(select(Project))}
    now = datetime.now(UTC)
    for demo in DEMO_CONVERSATIONS:
        owner = users.get(demo.owner)
        if owner is None:
            continue
        exists = db.scalar(
            select(Conversation.id).where(
                Conversation.user_id == owner.id, Conversation.title == demo.title
            )
        )
        if exists is not None:
            continue
        when = now - timedelta(days=demo.days_ago)
        project = projects.get(demo.project) if demo.project else None
        conversation = Conversation(
            user_id=owner.id,
            project_id=project.id if project else None,
            title=demo.title,
            title_is_default=False,
            created_at=when,
            updated_at=when,
            last_message_at=when + timedelta(minutes=len(demo.turns)),
        )
        position = 0
        for question, answer in demo.turns:
            for role, content in ((MessageRole.USER, question), (MessageRole.ASSISTANT, answer)):
                position += 1
                conversation.messages.append(
                    Message(
                        position=position,
                        role=role,
                        content=content,
                        status=MessageStatus.COMPLETE,
                        model="demo" if role == MessageRole.ASSISTANT else None,
                        created_at=when + timedelta(seconds=position * 20),
                    )
                )
        db.add(conversation)
        log.info("Created demo conversation for %s: %s", demo.owner, demo.title)
    db.flush()


def seed_demo(db: Session, storage: StorageService) -> None:
    password = get_settings().seed_demo_password
    roles = {r.code: r for r in db.scalars(select(Role))}

    users: dict[str, User] = {}
    for demo_user in DEMO_USERS:
        user = db.scalar(select(User).where(User.email == demo_user.email))
        if user is None:
            if not password:
                log.warning("SEED_DEMO_PASSWORD is empty: skipping demo user %s", demo_user.email)
                continue
            user = User(
                email=demo_user.email,
                full_name=demo_user.full_name,
                job_title=demo_user.job_title,
                password_hash=hash_password(password),
                # Demo accounts skip the forced change so the demo runs smoothly (D12).
                must_change_password=False,
                roles=[roles[demo_user.role]],
            )
            db.add(user)
            log.info("Created demo user %s", demo_user.email)
        users[demo_user.email] = user
    db.flush()

    for demo in DEMO_PROJECTS:
        if db.scalar(select(Project.id).where(Project.code == demo.code)) is not None:
            continue
        project = Project(
            code=demo.code,
            name=demo.name,
            subsystem=demo.subsystem,
            status=demo.status,
            description=demo.description,
        )
        for email, project_role in demo.members:
            if email in users:
                project.members.append(
                    ProjectMember(user_id=users[email].id, project_role=project_role)
                )
        db.add(project)
        log.info("Created demo project %s", demo.code)
    db.flush()

    seed_demo_documents(db, storage)
    seed_demo_conversations(db)
