"""Admin portal API routes."""

from fastapi import APIRouter

from api.admin.clinic import router as clinic_router
from api.admin.images import router as images_router
from api.admin.doctors import router as doctors_router
from api.admin.treatments import router as treatments_router
from api.admin.slots import router as slots_router
from api.admin.bookings import router as bookings_router
from api.admin.ecommerce import router as ecommerce_router
from api.admin.tags import router as tags_router
from api.admin.platform import router as platform_router

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])

admin_router.include_router(clinic_router)
admin_router.include_router(images_router)
admin_router.include_router(doctors_router)
admin_router.include_router(treatments_router)
admin_router.include_router(slots_router)
admin_router.include_router(bookings_router)
admin_router.include_router(ecommerce_router)
admin_router.include_router(tags_router)
admin_router.include_router(platform_router)
