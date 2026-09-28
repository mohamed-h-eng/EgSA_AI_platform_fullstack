from fastapi import APIRouter

from app.api.v1 import ai, auth, conversations, documents, health, me, projects, roles, users

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
# Registered by later phases: dashboard, admin settings
