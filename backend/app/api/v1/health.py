from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.api.deps import DbSession

router = APIRouter(tags=["health"])


@router.get("/health")
def health(response: Response, db: DbSession) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except Exception:
        database = "error"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ok" if database == "ok" else "degraded", "database": database}
