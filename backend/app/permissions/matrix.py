"""Default roles and their permissions (plan.md §10–11, security-permissions.md).

This file is the source of truth for the seeded roles: the seed syncs the DB to it.
Project-level rules (e.g. a lead only manages *their own* projects) are enforced in policies.py.
"""

from dataclasses import dataclass

from app.permissions.codes import PermissionCode as P


@dataclass(frozen=True)
class RoleDefinition:
    code: str
    name: str
    description: str
    permissions: frozenset[P]


ADMIN = "admin"
PROJECT_LEAD = "project_lead"
ENGINEER = "engineer"
VIEWER = "viewer"

ROLES: tuple[RoleDefinition, ...] = (
    RoleDefinition(
        ADMIN,
        "Admin",
        "Full platform administration",
        frozenset(P),
    ),
    RoleDefinition(
        PROJECT_LEAD,
        "Project Lead",
        "Leads projects: manages members and documents of own projects",
        frozenset(
            {
                P.USERS_READ,
                P.PROJECTS_READ,
                P.PROJECTS_CREATE,
                P.PROJECTS_UPDATE,
                P.PROJECTS_MANAGE_MEMBERS,
                P.DOCUMENTS_READ,
                P.DOCUMENTS_UPLOAD,
                P.DOCUMENTS_DELETE,
                P.DOCUMENTS_DELETE_ANY,
                P.CHAT_USE,
            }
        ),
    ),
    RoleDefinition(
        ENGINEER,
        "Engineer",
        "Works in assigned projects: reads and uploads documents",
        frozenset(
            {
                P.USERS_READ,
                P.PROJECTS_READ,
                P.DOCUMENTS_READ,
                P.DOCUMENTS_UPLOAD,
                P.DOCUMENTS_DELETE,
                P.CHAT_USE,
            }
        ),
    ),
    RoleDefinition(
        VIEWER,
        "Viewer",
        "Read-only access to assigned projects",
        frozenset({P.PROJECTS_READ, P.DOCUMENTS_READ, P.CHAT_USE}),
    ),
)
