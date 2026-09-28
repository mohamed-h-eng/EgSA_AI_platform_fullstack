import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import Client, DbSession, require_permission
from app.models.user import User
from app.permissions.codes import PermissionCode as P
from app.schemas.common import Page, PageParams, page_params
from app.schemas.projects import UserProjectMembership
from app.schemas.users import (
    PasswordReset,
    RoleAssign,
    TemporaryPassword,
    UserCreate,
    UserCreated,
    UserOut,
    UserStatus,
    UserUpdate,
)
from app.services.projects import service as projects
from app.services.users import service as users

router = APIRouter(prefix="/users", tags=["users"])

CanRead = Annotated[User, Depends(require_permission(P.USERS_READ))]
CanCreate = Annotated[User, Depends(require_permission(P.USERS_CREATE))]
CanUpdate = Annotated[User, Depends(require_permission(P.USERS_UPDATE))]
CanDisable = Annotated[User, Depends(require_permission(P.USERS_DISABLE))]
CanAssignRoles = Annotated[User, Depends(require_permission(P.ROLES_ASSIGN))]


@router.get("", response_model=Page[UserOut])
def list_users(
    _: CanRead,
    db: DbSession,
    params: Annotated[PageParams, Depends(page_params)],
    q: Annotated[str | None, Query(max_length=100)] = None,
    role: Annotated[str | None, Query(max_length=64)] = None,
    status_: Annotated[UserStatus | None, Query(alias="status")] = None,
) -> Page[UserOut]:
    items, total = users.list_users(db, params, q=q, role=role, status=status_)
    return Page(
        items=[UserOut.from_user(u) for u in items],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@router.post("", response_model=UserCreated, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, actor: CanCreate, db: DbSession, client: Client) -> UserCreated:
    user, temporary = users.create_user(db, actor, body, ip=client.ip)
    return UserCreated(user=UserOut.from_user(user), temporary_password=temporary)


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: uuid.UUID, _: CanRead, db: DbSession) -> UserOut:
    return UserOut.from_user(users.get_user(db, user_id))


@router.get("/{user_id}/projects", response_model=list[UserProjectMembership])
def list_user_projects(
    user_id: uuid.UUID, actor: CanRead, db: DbSession
) -> list[UserProjectMembership]:
    """Projects this user belongs to, limited to projects the caller can see."""
    users.get_user(db, user_id)  # 404 for unknown users
    return projects.list_user_memberships(db, actor, user_id)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: uuid.UUID, body: UserUpdate, actor: CanUpdate, db: DbSession, client: Client
) -> UserOut:
    return UserOut.from_user(users.update_user(db, actor, user_id, body, ip=client.ip))


@router.post("/{user_id}/disable", response_model=UserOut)
def disable_user(user_id: uuid.UUID, actor: CanDisable, db: DbSession, client: Client) -> UserOut:
    return UserOut.from_user(users.set_active(db, actor, user_id, False, ip=client.ip))


@router.post("/{user_id}/enable", response_model=UserOut)
def enable_user(user_id: uuid.UUID, actor: CanDisable, db: DbSession, client: Client) -> UserOut:
    return UserOut.from_user(users.set_active(db, actor, user_id, True, ip=client.ip))


@router.put("/{user_id}/role", response_model=UserOut)
def assign_role(
    user_id: uuid.UUID, body: RoleAssign, actor: CanAssignRoles, db: DbSession, client: Client
) -> UserOut:
    return UserOut.from_user(users.assign_role(db, actor, user_id, body.role, ip=client.ip))


@router.post("/{user_id}/reset-password", response_model=TemporaryPassword)
def reset_password(
    user_id: uuid.UUID, body: PasswordReset, actor: CanUpdate, db: DbSession, client: Client
) -> TemporaryPassword:
    temporary = users.reset_password(db, actor, user_id, body.temporary_password, ip=client.ip)
    return TemporaryPassword(temporary_password=temporary)
