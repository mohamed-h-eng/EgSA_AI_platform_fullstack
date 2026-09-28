from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, require_permission
from app.models.user import User
from app.permissions.codes import PermissionCode as P
from app.schemas.users import RoleOut
from app.services.users import service as users

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=list[RoleOut])
def list_roles(
    _: Annotated[User, Depends(require_permission(P.ROLES_READ))], db: DbSession
) -> list[RoleOut]:
    return [
        RoleOut(
            code=r.code,
            name=r.name,
            description=r.description,
            permissions=sorted(p.code for p in r.permissions),
        )
        for r in users.list_roles(db)
    ]
