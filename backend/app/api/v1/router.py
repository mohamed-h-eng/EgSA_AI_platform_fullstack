from fastapi import APIRouter

from app.api.v1 import (
    admin,
    ai,
    auth,
    conversations,
    dashboard,
    documents,
    health,
    me,
    projects,
    roles,
    users,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(me.router)
api_router.include_router(users.router)
api_router.include_router(roles.router)
api_router.include_router(projects.router)
api_router.include_router(documents.router)
api_router.include_router(conversations.router)
api_router.include_router(ai.router)
api_router.include_router(dashboard.router)
api_router.include_router(admin.router)
