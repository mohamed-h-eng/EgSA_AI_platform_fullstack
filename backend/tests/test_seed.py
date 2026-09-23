from sqlalchemy import func, select

from app.database.seed import seed
from app.models.permission import Permission
from app.models.role import Role
from app.models.user import User
from app.permissions.codes import PermissionCode
from app.permissions.matrix import ROLES


def test_seed_creates_roles_permissions_and_admin_idempotently(db):
    seed(db)
    seed(db)  # running twice must not duplicate anything

    assert db.scalar(select(func.count()).select_from(Permission)) == len(PermissionCode)
    assert db.scalar(select(func.count()).select_from(Role)) == len(ROLES)
    assert db.scalar(select(func.count()).select_from(User)) == 1

    roles = {r.code: {p.code for p in r.permissions} for r in db.scalars(select(Role))}
    assert roles["admin"] == {str(c) for c in PermissionCode}
    assert roles["viewer"] == {"projects:read", "documents:read", "chat:use"}
    assert "documents:upload" not in roles["viewer"]

    admin = db.scalar(select(User))
    assert admin.role_codes == ["admin"]
    assert admin.must_change_password is False


def test_seed_resyncs_role_permissions_to_the_matrix(db):
    seed(db)
    viewer = db.scalar(select(Role).where(Role.code == "viewer"))
    viewer.permissions = []
    db.commit()

    seed(db)
    db.refresh(viewer)
    assert {p.code for p in viewer.permissions} == {"projects:read", "documents:read", "chat:use"}
