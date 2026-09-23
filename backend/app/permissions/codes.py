"""Permission codes (.agent/rules/security-permissions.md).

Adding a code: add it here with a description, grant it in matrix.py, and re-run the seed.
"""

from enum import StrEnum


class PermissionCode(StrEnum):
    USERS_READ = "users:read"
    USERS_CREATE = "users:create"
    USERS_UPDATE = "users:update"
    USERS_DISABLE = "users:disable"

    ROLES_READ = "roles:read"
    ROLES_ASSIGN = "roles:assign"

    PROJECTS_READ = "projects:read"
    PROJECTS_CREATE = "projects:create"
    PROJECTS_UPDATE = "projects:update"
    PROJECTS_DELETE = "projects:delete"
    PROJECTS_MANAGE_MEMBERS = "projects:manage_members"

    DOCUMENTS_READ = "documents:read"
    DOCUMENTS_UPLOAD = "documents:upload"
    DOCUMENTS_DELETE = "documents:delete"
    DOCUMENTS_DELETE_ANY = "documents:delete_any"

    CHAT_USE = "chat:use"

    SETTINGS_READ = "settings:read"
    SETTINGS_MANAGE = "settings:manage"

    AUDIT_READ = "audit:read"


DESCRIPTIONS: dict[PermissionCode, str] = {
    PermissionCode.USERS_READ: "View users",
    PermissionCode.USERS_CREATE: "Create users",
    PermissionCode.USERS_UPDATE: "Edit users and reset passwords",
    PermissionCode.USERS_DISABLE: "Enable or disable users",
    PermissionCode.ROLES_READ: "View roles and their permissions",
    PermissionCode.ROLES_ASSIGN: "Change a user's role",
    PermissionCode.PROJECTS_READ: "View projects the user is a member of",
    PermissionCode.PROJECTS_CREATE: "Create projects",
    PermissionCode.PROJECTS_UPDATE: "Edit projects",
    PermissionCode.PROJECTS_DELETE: "Delete (archive) projects",
    PermissionCode.PROJECTS_MANAGE_MEMBERS: "Add, remove and change project members",
    PermissionCode.DOCUMENTS_READ: "View and download documents",
    PermissionCode.DOCUMENTS_UPLOAD: "Upload documents",
    PermissionCode.DOCUMENTS_DELETE: "Delete own documents",
    PermissionCode.DOCUMENTS_DELETE_ANY: "Delete any document in accessible projects",
    PermissionCode.CHAT_USE: "Use AI chat",
    PermissionCode.SETTINGS_READ: "View platform settings",
    PermissionCode.SETTINGS_MANAGE: "Change platform and AI settings",
    PermissionCode.AUDIT_READ: "View the audit log",
}
