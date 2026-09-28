"""Dashboard summary (phase 09): everything is scoped to what the caller may see."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.ai import AIUsage
from app.models.document import Document
from app.models.project import Project
from app.models.user import User
from app.permissions.codes import PermissionCode as P
from app.schemas.admin import AdminStats, AIUserUsage, DashboardCounts, DashboardSummary
from app.schemas.common import PageParams
from app.schemas.projects import UserSummary
from app.services.chat import service as chat
from app.services.documents import service as documents
from app.services.projects import service as projects

RECENT = PageParams(page=1, page_size=5)
MY_PROJECTS = PageParams(page=1, page_size=6)
USAGE_WINDOW = timedelta(days=7)


def summary(db: Session, user: User) -> DashboardSummary:
    my_projects, project_total = (
        projects.list_projects(db, user, MY_PROJECTS)
        if user.has_permission(P.PROJECTS_READ)
        else ([], 0)
    )
    recent_documents, document_total = (
        documents.list_documents(db, user, RECENT)
        if user.has_permission(P.DOCUMENTS_READ)
        else ([], 0)
    )
    recent_conversations, conversation_total = (
        chat.list_conversations(db, user, RECENT) if user.has_permission(P.CHAT_USE) else ([], 0)
    )
    ai_requests = db.scalar(select(func.count()).where(AIUsage.user_id == user.id)) or 0

    return DashboardSummary(
        counts=DashboardCounts(
            projects=project_total,
            documents=document_total,
            conversations=conversation_total,
            ai_requests=ai_requests,
        ),
        recent_conversations=recent_conversations,
        recent_documents=recent_documents,
        my_projects=my_projects,
        admin=admin_stats(db) if user.has_permission(P.SETTINGS_MANAGE) else None,
    )


def admin_stats(db: Session, *, now: datetime | None = None) -> AdminStats:
    since = (now or datetime.now(UTC)) - USAGE_WINDOW
    failed = func.sum(case((AIUsage.status == "error", 1), else_=0))
    tokens = func.sum(
        func.coalesce(AIUsage.prompt_tokens, 0) + func.coalesce(AIUsage.completion_tokens, 0)
    )
    rows = db.execute(
        select(AIUsage.user_id, func.count(), failed, tokens)
        .where(AIUsage.created_at >= since)
        .group_by(AIUsage.user_id)
        .order_by(func.count().desc())
    ).all()
    users = {
        u.id: u for u in db.scalars(select(User).where(User.id.in_([r[0] for r in rows if r[0]])))
    }
    usage = [
        AIUserUsage(
            user=UserSummary(id=u.id, full_name=u.full_name, email=u.email)
            if (u := users.get(user_id))
            else None,
            requests=count,
            failed=int(n_failed or 0),
            tokens=int(n_tokens or 0),
        )
        for user_id, count, n_failed, n_tokens in rows
    ]
    return AdminStats(
        active_users=db.scalar(select(func.count()).where(User.is_active.is_(True))) or 0,
        total_users=db.scalar(select(func.count()).select_from(User)) or 0,
        total_projects=db.scalar(select(func.count()).where(Project.deleted_at.is_(None))) or 0,
        total_documents=db.scalar(
            select(func.count())
            .select_from(Document)
            .join(Project, Project.id == Document.project_id)
            .where(Project.deleted_at.is_(None))
        )
        or 0,
        ai_requests_7d=sum(u.requests for u in usage),
        failed_ai_requests_7d=sum(u.failed for u in usage),
        tokens_7d=sum(u.tokens for u in usage),
        ai_usage_7d=usage,
    )
