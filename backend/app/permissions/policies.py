"""Authorization policies that go beyond a single permission code.

Project access (plan §16, ADR-06):
    can_access(user, project) = user is admin OR user is a member of the project
    effective action          = global permission AND can_access AND the project role allows it
Soft-deleted projects are invisible to everyone (D16).
"""

import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.project import Project, ProjectMember, ProjectRole
from app.models.role import Role, user_roles
from app.models.user import User
from app.permissions.codes import PermissionCode as P
from app.permissions.matrix import ADMIN


def is_admin(user: User) -> bool:
    return ADMIN in user.role_codes


def count_active_admins(db: Session, *, excluding: User | None = None) -> int:
    query = (
        select(func.count(func.distinct(User.id)))
        .join(user_roles, user_roles.c.user_id == User.id)
        .join(Role, Role.id == user_roles.c.role_id)
        .where(Role.code == ADMIN, User.is_active.is_(True))
    )
    if excluding is not None:
        query = query.where(User.id != excluding.id)
    return db.scalar(query) or 0


# ── Projects ──────────────────────────────────────────────


def visible_project_ids(user: User) -> Select[tuple[uuid.UUID]]:
    """SQL subquery of project ids the user may see. Use it to filter every project-scoped
    query IN SQL (never load everything and filter in Python)."""
    query = select(Project.id).where(Project.deleted_at.is_(None))
    if not is_admin(user):
        query = query.join(ProjectMember, ProjectMember.project_id == Project.id).where(
            ProjectMember.user_id == user.id
        )
    return query


def project_role(db: Session, user: User, project_id: uuid.UUID) -> ProjectRole | None:
    role = db.scalar(
        select(ProjectMember.project_role).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user.id
        )
    )
    return ProjectRole(role) if role else None


def can_access_project(db: Session, user: User, project: Project) -> bool:
    if project.deleted_at is not None:
        return False
    return is_admin(user) or project_role(db, user, project.id) is not None


def _is_lead(db: Session, user: User, project: Project) -> bool:
    return project_role(db, user, project.id) == ProjectRole.LEAD


def can_edit_project(db: Session, user: User, project: Project) -> bool:
    return user.has_permission(P.PROJECTS_UPDATE) and (
        is_admin(user) or _is_lead(db, user, project)
    )


def can_manage_members(db: Session, user: User, project: Project) -> bool:
    return user.has_permission(P.PROJECTS_MANAGE_MEMBERS) and (
        is_admin(user) or _is_lead(db, user, project)
    )


def can_delete_project(user: User) -> bool:
    return user.has_permission(P.PROJECTS_DELETE)


# ── Documents ─────────────────────────────────────────────
# Project viewers are read-only. Engineers/leads may upload; leads may manage everyone's
# documents; uploaders may manage their own while they're still a contributor.

_CONTRIBUTORS = (ProjectRole.LEAD, ProjectRole.ENGINEER)


def can_upload_to_project(db: Session, user: User, project: Project) -> bool:
    if not (user.has_permission(P.DOCUMENTS_UPLOAD) and can_access_project(db, user, project)):
        return False
    return is_admin(user) or project_role(db, user, project.id) in _CONTRIBUTORS


def can_edit_document(
    user: User, role: ProjectRole | None, uploaded_by_id: uuid.UUID | None
) -> bool:
    if is_admin(user):
        return True
    if not user.has_permission(P.DOCUMENTS_UPLOAD):
        return False
    return role == ProjectRole.LEAD or (uploaded_by_id == user.id and role in _CONTRIBUTORS)


def can_delete_document(
    user: User, role: ProjectRole | None, uploaded_by_id: uuid.UUID | None
) -> bool:
    if is_admin(user):
        return True
    if user.has_permission(P.DOCUMENTS_DELETE_ANY) and role == ProjectRole.LEAD:
        return True
    return (
        user.has_permission(P.DOCUMENTS_DELETE)
        and uploaded_by_id == user.id
        and role in _CONTRIBUTORS
    )


def project_roles_for(
    db: Session, user: User, project_ids: list[uuid.UUID]
) -> dict[uuid.UUID, ProjectRole]:
    """The user's role in each of the given projects, in one query (for list pages)."""
    rows = db.execute(
        select(ProjectMember.project_id, ProjectMember.project_role).where(
            ProjectMember.user_id == user.id, ProjectMember.project_id.in_(project_ids)
        )
    )
    return {project_id: ProjectRole(role) for project_id, role in rows}
