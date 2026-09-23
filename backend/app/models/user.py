from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, false, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.role import Role, user_roles


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    # Always stored lower-cased (see services/auth), which makes the unique index case-insensitive.
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    job_title: Mapped[str | None] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(255))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    # Set for admin-created / admin-reset passwords (decision D9).
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false()
    )
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    roles: Mapped[list[Role]] = relationship(secondary=user_roles, lazy="selectin")

    @property
    def role_codes(self) -> list[str]:
        return sorted(r.code for r in self.roles)

    @property
    def permission_codes(self) -> set[str]:
        return {p.code for r in self.roles for p in r.permissions}

    def has_permission(self, code: str) -> bool:
        return code in self.permission_codes
