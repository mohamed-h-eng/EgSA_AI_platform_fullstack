"""ORM models. Import every model module here so Alembic autogenerate sees it."""

from app.models.ai import AISettings, AIUsage
from app.models.app_settings import AppSettings
from app.models.audit import AuditLog
from app.models.conversation import (
    Conversation,
    ConversationVisibility,
    Message,
    MessageRole,
    MessageStatus,
)
from app.models.document import (
    Document,
    DocumentCategory,
    DocumentPermission,
    DocumentStatus,
    FileType,
)
from app.models.permission import Permission
from app.models.project import Project, ProjectMember, ProjectRole, ProjectStatus
from app.models.refresh_token import RefreshToken
from app.models.role import Role, role_permissions, user_roles
from app.models.user import User

__all__ = [
    "AISettings",
    "AIUsage",
    "AppSettings",
    "AuditLog",
    "Conversation",
    "ConversationVisibility",
    "Message",
    "MessageRole",
    "MessageStatus",
    "Document",
    "DocumentCategory",
    "DocumentPermission",
    "DocumentStatus",
    "FileType",
    "Permission",
    "Project",
    "ProjectMember",
    "ProjectRole",
    "ProjectStatus",
    "RefreshToken",
    "Role",
    "User",
    "role_permissions",
    "user_roles",
]
