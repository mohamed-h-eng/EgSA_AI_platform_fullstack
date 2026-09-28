from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.admin import DashboardSummary
from app.services.dashboard import service as dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(user: CurrentUser, db: DbSession) -> DashboardSummary:
    """Counts and recent items scoped to the caller; admins also get usage stats (D11)."""
    return dashboard.summary(db, user)
