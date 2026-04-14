"""Admin portal API routes."""

from fastapi import APIRouter

from api.admin.clinic import router as clinic_router
from api.admin.experiences import router as experiences_router
from api.admin.images import router as images_router
from api.admin.retreats import router as retreats_router
from api.admin.team import router as team_router
from api.admin.bookings import router as bookings_router
from api.admin.tags import router as tags_router
from api.admin.platform import router as platform_router
from api.admin.platform_experiences import router as platform_experiences_router
from api.admin.users import router as users_router

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])

admin_router.include_router(clinic_router)
admin_router.include_router(experiences_router)
admin_router.include_router(images_router)
admin_router.include_router(retreats_router)
admin_router.include_router(team_router)
admin_router.include_router(bookings_router)
admin_router.include_router(tags_router)
admin_router.include_router(platform_router)
admin_router.include_router(platform_experiences_router)
admin_router.include_router(users_router)
