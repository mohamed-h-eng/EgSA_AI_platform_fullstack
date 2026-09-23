"""Idempotent seed: permissions, roles (synced to permissions/matrix.py) and the first admin.

Run: `python -m app.database.seed` (the Docker entrypoint does this after migrations).
"""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.permission import Permission
from app.models.role import Role
from app.models.user import User
from app.permissions.codes import DESCRIPTIONS, PermissionCode
from app.permissions.matrix import ADMIN, ROLES
from app.services.auth.providers import normalize_email

log = logging.getLogger(__name__)


def seed_permissions_and_roles(db: Session) -> None:
    permissions = {p.code: p for p in db.scalars(select(Permission))}
    for code in PermissionCode:
        if code not in permissions:
            permissions[code] = Permission(code=str(code), description=DESCRIPTIONS.get(code))
            db.add(permissions[code])
        else:
            permissions[code].description = DESCRIPTIONS.get(code)

    roles = {r.code: r for r in db.scalars(select(Role))}
    for definition in ROLES:
        role = roles.get(definition.code)
        if role is None:
            role = Role(code=definition.code)
            db.add(role)
        role.name = definition.name
        role.description = definition.description
        # Seeded roles always match the matrix exactly.
        role.permissions = [permissions[c] for c in sorted(definition.permissions)]
    db.flush()


def seed_admin(db: Session) -> None:
    settings = get_settings()
    email = normalize_email(settings.seed_admin_email)
    if db.scalar(select(User).where(User.email == email)) is not None:
        return
    admin_role = db.scalar(select(Role).where(Role.code == ADMIN))
    assert admin_role is not None, "roles must be seeded first"
    db.add(
        User(
            email=email,
            full_name="Platform Administrator",
            job_title="Administrator",
            password_hash=hash_password(settings.seed_admin_password),
            roles=[admin_role],
        )
    )
    log.info("Created seed admin %s", email)


def seed(db: Session) -> None:
    seed_permissions_and_roles(db)
    seed_admin(db)
    db.commit()


def main() -> None:
    from app.core.logging import configure_logging
    from app.database.session import SessionLocal

    configure_logging()
    settings = get_settings()
    if settings.environment == "production" and settings.seed_admin_password.startswith(
        "change-me"
    ):
        raise SystemExit("Refusing to seed: SEED_ADMIN_PASSWORD is still the placeholder value.")
    with SessionLocal() as db:
        seed(db)
    log.info("Seed complete")


if __name__ == "__main__":
    main()
