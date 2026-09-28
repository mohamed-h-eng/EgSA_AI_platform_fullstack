"""Projects and project membership (plan §12, §16, workflow 04)."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.models.project import Project, ProjectMember, ProjectRole, ProjectStatus
from app.models.user import User
from app.permissions import policies
from app.schemas.common import PageParams
from app.schemas.projects import (
    MemberOut,
    ProjectAbilities,
    ProjectCreate,
    ProjectDetail,
    ProjectOut,
    ProjectUpdate,
    UserProjectMembership,
    UserSummary,
)
from app.services import audit
from app.services.audit import AuditAction
from app.services.documents.service import document_counts

# ── Lookups ───────────────────────────────────────────────


def _not_found() -> NotFoundError:
    return NotFoundError("Project not found.", code="PROJECT_NOT_FOUND")


def get_visible_project(db: Session, user: User, project_id: uuid.UUID) -> Project:
    """The project if the user may see it; otherwise 404 (never reveal that it exists)."""
    project = db.get(Project, project_id)
    if project is None or not policies.can_access_project(db, user, project):
        raise _not_found()
    return project


def _summary(user: User | None) -> UserSummary | None:
    if user is None:
        return None
    return UserSummary(id=user.id, full_name=user.full_name, email=user.email)


def _to_out(
    project: Project, member_count: int, document_count: int, my_role: str | None
) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        code=project.code,
        name=project.name,
        description=project.description,
        subsystem=project.subsystem,
        status=ProjectStatus(project.status),
        member_count=member_count,
        document_count=document_count,
        my_role=ProjectRole(my_role) if my_role else None,
        created_by=_summary(project.created_by),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def to_detail(db: Session, user: User, project: Project) -> ProjectDetail:
    role = policies.project_role(db, user, project.id)
    out = _to_out(
        project, len(project.members), document_counts(db, [project.id]).get(project.id, 0), role
    )
    return ProjectDetail(
        **out.model_dump(),
        abilities=ProjectAbilities(
            can_edit=policies.can_edit_project(db, user, project),
            can_manage_members=policies.can_manage_members(db, user, project),
            can_delete=policies.can_delete_project(user),
        ),
    )


# ── Projects ──────────────────────────────────────────────


def list_projects(
    db: Session,
    user: User,
    params: PageParams,
    *,
    q: str | None = None,
    status: ProjectStatus | None = None,
) -> tuple[list[ProjectOut], int]:
    query = select(Project).where(Project.id.in_(policies.visible_project_ids(user)))
    if q and q.strip():
        term = q.strip()
        query = query.where(
            or_(
                Project.code.icontains(term, autoescape=True),
                Project.name.icontains(term, autoescape=True),
                Project.subsystem.icontains(term, autoescape=True),
            )
        )
    if status:
        query = query.where(Project.status == status)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    projects = list(
        db.scalars(query.order_by(Project.code).offset(params.offset).limit(params.page_size))
    )
    ids = [p.id for p in projects]

    # Unpack rows explicitly: dict(result) would treat the Result's .keys() as a mapping.
    counts = {
        project_id: count
        for project_id, count in db.execute(
            select(ProjectMember.project_id, func.count())
            .where(ProjectMember.project_id.in_(ids))
            .group_by(ProjectMember.project_id)
        )
    }
    my_roles = {
        project_id: role
        for project_id, role in db.execute(
            select(ProjectMember.project_id, ProjectMember.project_role).where(
                ProjectMember.project_id.in_(ids), ProjectMember.user_id == user.id
            )
        )
    }
    docs = document_counts(db, ids)
    return [
        _to_out(p, counts.get(p.id, 0), docs.get(p.id, 0), my_roles.get(p.id)) for p in projects
    ], total


def create_project(db: Session, actor: User, data: ProjectCreate, *, ip: str | None) -> Project:
    if db.scalar(select(Project.id).where(Project.code == data.code)) is not None:
        raise ConflictError(
            f"The project code {data.code} is already in use.", code="PROJECT_CODE_EXISTS"
        )
    project = Project(
        code=data.code,
        name=data.name,
        description=data.description,
        subsystem=data.subsystem,
        status=data.status,
        created_by_id=actor.id,
    )
    # The creator leads the project, so they can manage it right away.
    project.members.append(ProjectMember(user_id=actor.id, project_role=ProjectRole.LEAD))
    db.add(project)
    db.flush()
    audit.log(
        db,
        AuditAction.PROJECT_CREATE,
        actor_id=actor.id,
        target_type="project",
        target_id=project.id,
        meta={"code": project.code},
        ip=ip,
    )
    db.commit()
    db.refresh(project)
    return project


def update_project(
    db: Session, actor: User, project_id: uuid.UUID, data: ProjectUpdate, *, ip: str | None
) -> Project:
    project = get_visible_project(db, actor, project_id)
    if not policies.can_edit_project(db, actor, project):
        raise ForbiddenError("Only the project lead or an administrator can edit this project.")

    changed = []
    for field in ("name", "description", "subsystem", "status"):
        if field not in data.model_fields_set:
            continue
        value = getattr(data, field)
        if field in ("name", "status") and value is None:
            continue  # required fields can't be cleared
        if getattr(project, field) != value:
            setattr(project, field, value)
            changed.append(field)

    if changed:
        audit.log(
            db,
            AuditAction.PROJECT_UPDATE,
            actor_id=actor.id,
            target_type="project",
            target_id=project.id,
            meta={"changed": changed},
            ip=ip,
        )
        db.commit()
    return project


def delete_project(db: Session, actor: User, project_id: uuid.UUID, *, ip: str | None) -> None:
    """Soft delete (D16): hidden everywhere, row and memberships kept for audit/recovery."""
    project = get_visible_project(db, actor, project_id)
    if not policies.can_delete_project(actor):
        raise ForbiddenError("Only an administrator can delete projects.")
    project.deleted_at = datetime.now(UTC)
    audit.log(
        db,
        AuditAction.PROJECT_DELETE,
        actor_id=actor.id,
        target_type="project",
        target_id=project.id,
        meta={"code": project.code},
        ip=ip,
    )
    db.commit()


# ── Members ───────────────────────────────────────────────


def _member_out(member: ProjectMember) -> MemberOut:
    return MemberOut(
        user=UserSummary(
            id=member.user.id, full_name=member.user.full_name, email=member.user.email
        ),
        user_is_active=member.user.is_active,
        project_role=ProjectRole(member.project_role),
        added_at=member.added_at,
    )


def list_members(db: Session, actor: User, project_id: uuid.UUID) -> list[MemberOut]:
    project = get_visible_project(db, actor, project_id)
    order = {ProjectRole.LEAD: 0, ProjectRole.ENGINEER: 1, ProjectRole.VIEWER: 2}
    members = sorted(
        project.members,
        key=lambda m: (order[ProjectRole(m.project_role)], m.user.full_name.lower()),
    )
    return [_member_out(m) for m in members]


def _require_manager(db: Session, actor: User, project_id: uuid.UUID) -> Project:
    project = get_visible_project(db, actor, project_id)
    if not policies.can_manage_members(db, actor, project):
        raise ForbiddenError("Only the project lead or an administrator can manage members.")
    return project


def _get_member(project: Project, user_id: uuid.UUID) -> ProjectMember:
    for member in project.members:
        if member.user_id == user_id:
            return member
    raise NotFoundError("This user is not a member of the project.", code="MEMBER_NOT_FOUND")


def _ensure_other_lead(project: Project, member: ProjectMember) -> None:
    other_leads = [
        m for m in project.members if m.project_role == ProjectRole.LEAD and m is not member
    ]
    if member.project_role == ProjectRole.LEAD and not other_leads:
        raise AppError(
            "A project must keep at least one lead. Make someone else lead first.",
            code="LAST_PROJECT_LEAD",
        )


def add_member(
    db: Session,
    actor: User,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    role: ProjectRole,
    *,
    ip: str | None,
) -> MemberOut:
    project = _require_manager(db, actor, project_id)
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found.", code="USER_NOT_FOUND")
    if not user.is_active:
        raise AppError("Disabled users can't be added to projects.", code="USER_INACTIVE")
    if any(m.user_id == user_id for m in project.members):
        raise ConflictError("This user is already a member.", code="ALREADY_MEMBER")

    member = ProjectMember(user_id=user.id, project_role=role)
    project.members.append(member)
    audit.log(
        db,
        AuditAction.PROJECT_MEMBER_ADD,
        actor_id=actor.id,
        target_type="project",
        target_id=project.id,
        meta={"user_id": str(user.id), "role": str(role)},
        ip=ip,
    )
    db.commit()
    db.refresh(member)
    return _member_out(member)


def update_member(
    db: Session,
    actor: User,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    role: ProjectRole,
    *,
    ip: str | None,
) -> MemberOut:
    project = _require_manager(db, actor, project_id)
    member = _get_member(project, user_id)
    if member.project_role == role:
        return _member_out(member)
    if role != ProjectRole.LEAD:
        _ensure_other_lead(project, member)

    previous = member.project_role
    member.project_role = role
    audit.log(
        db,
        AuditAction.PROJECT_MEMBER_ROLE_CHANGE,
        actor_id=actor.id,
        target_type="project",
        target_id=project.id,
        meta={"user_id": str(user_id), "from": previous, "to": str(role)},
        ip=ip,
    )
    db.commit()
    return _member_out(member)


def remove_member(
    db: Session, actor: User, project_id: uuid.UUID, user_id: uuid.UUID, *, ip: str | None
) -> None:
    project = _require_manager(db, actor, project_id)
    member = _get_member(project, user_id)
    _ensure_other_lead(project, member)
    project.members.remove(member)
    audit.log(
        db,
        AuditAction.PROJECT_MEMBER_REMOVE,
        actor_id=actor.id,
        target_type="project",
        target_id=project.id,
        meta={"user_id": str(user_id)},
        ip=ip,
    )
    db.commit()


def list_user_memberships(
    db: Session, actor: User, user_id: uuid.UUID
) -> list[UserProjectMembership]:
    """Projects `user_id` belongs to, limited to projects the *actor* can see."""
    rows = db.execute(
        select(Project, ProjectMember.project_role)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(
            ProjectMember.user_id == user_id,
            Project.id.in_(policies.visible_project_ids(actor)),
        )
        .order_by(Project.code)
    ).tuples()
    return [
        UserProjectMembership(
            project_id=p.id,
            code=p.code,
            name=p.name,
            status=ProjectStatus(p.status),
            project_role=ProjectRole(role),
        )
        for p, role in rows
    ]
