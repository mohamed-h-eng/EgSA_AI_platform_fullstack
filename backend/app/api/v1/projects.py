import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import Client, DbSession, require_permission
from app.models.project import ProjectStatus
from app.models.user import User
from app.permissions.codes import PermissionCode as P
from app.schemas.common import Page, PageParams, page_params
from app.schemas.projects import (
    MemberAdd,
    MemberOut,
    MemberUpdate,
    ProjectCreate,
    ProjectDetail,
    ProjectOut,
    ProjectUpdate,
)
from app.services.projects import service as projects

router = APIRouter(prefix="/projects", tags=["projects"])

# Global permission first; project-level rules (membership, lead) are enforced in the service.
CanRead = Annotated[User, Depends(require_permission(P.PROJECTS_READ))]
CanCreate = Annotated[User, Depends(require_permission(P.PROJECTS_CREATE))]
CanUpdate = Annotated[User, Depends(require_permission(P.PROJECTS_UPDATE))]
CanDelete = Annotated[User, Depends(require_permission(P.PROJECTS_DELETE))]
CanManageMembers = Annotated[User, Depends(require_permission(P.PROJECTS_MANAGE_MEMBERS))]


@router.get("", response_model=Page[ProjectOut])
def list_projects(
    user: CanRead,
    db: DbSession,
    params: Annotated[PageParams, Depends(page_params)],
    q: Annotated[str | None, Query(max_length=100)] = None,
    status_: Annotated[ProjectStatus | None, Query(alias="status")] = None,
) -> Page[ProjectOut]:
    items, total = projects.list_projects(db, user, params, q=q, status=status_)
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


@router.post("", response_model=ProjectDetail, status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreate, actor: CanCreate, db: DbSession, client: Client
) -> ProjectDetail:
    project = projects.create_project(db, actor, body, ip=client.ip)
    return projects.to_detail(db, actor, project)


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: uuid.UUID, user: CanRead, db: DbSession) -> ProjectDetail:
    return projects.to_detail(db, user, projects.get_visible_project(db, user, project_id))


@router.patch("/{project_id}", response_model=ProjectDetail)
def update_project(
    project_id: uuid.UUID, body: ProjectUpdate, actor: CanUpdate, db: DbSession, client: Client
) -> ProjectDetail:
    project = projects.update_project(db, actor, project_id, body, ip=client.ip)
    return projects.to_detail(db, actor, project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: uuid.UUID, actor: CanDelete, db: DbSession, client: Client
) -> Response:
    projects.delete_project(db, actor, project_id, ip=client.ip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/members", response_model=list[MemberOut])
def list_members(project_id: uuid.UUID, user: CanRead, db: DbSession) -> list[MemberOut]:
    return projects.list_members(db, user, project_id)


@router.post("/{project_id}/members", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def add_member(
    project_id: uuid.UUID, body: MemberAdd, actor: CanManageMembers, db: DbSession, client: Client
) -> MemberOut:
    return projects.add_member(db, actor, project_id, body.user_id, body.project_role, ip=client.ip)


@router.patch("/{project_id}/members/{user_id}", response_model=MemberOut)
def update_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    body: MemberUpdate,
    actor: CanManageMembers,
    db: DbSession,
    client: Client,
) -> MemberOut:
    return projects.update_member(db, actor, project_id, user_id, body.project_role, ip=client.ip)


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    actor: CanManageMembers,
    db: DbSession,
    client: Client,
) -> Response:
    projects.remove_member(db, actor, project_id, user_id, ip=client.ip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
