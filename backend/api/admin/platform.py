"""
api/admin/platform.py — Platform admin endpoints.

Requires platform_admin role.

GET    /api/admin/platform/clinics
PATCH  /api/admin/platform/clinics/{id}/tier
PATCH  /api/admin/platform/clinics/{id}/activate
PATCH  /api/admin/platform/clinics/{id}/deactivate
GET    /api/admin/platform/stats
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import require_platform_admin
from db.database import get_db
from db.models import Booking, ClinicFeatureStore, Doctor, User

router = APIRouter(prefix="/platform")


# ── Pydantic models ──────────────────────────────────────────────────────────

class ClinicListItem(BaseModel):
    id: str
    name: str
    slug: str
    tier: int
    is_active: bool
    doctor_count: int
    booking_count_30d: int
    revenue_30d: float
    outcome_enrolled: bool


class TierUpgrade(BaseModel):
    tier: int
    notes: str | None = None


class PlatformStats(BaseModel):
    total_clinics: int
    total_doctors: int
    total_bookings: int
    total_gmv: float
    total_revenue: float


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/clinics", response_model=list[ClinicListItem])
async def list_all_clinics(
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    clinics = (await db.execute(
        select(ClinicFeatureStore).order_by(ClinicFeatureStore.name)
    )).scalars().all()

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    result = []

    for c in clinics:
        # Doctor count
        doc_count = (await db.execute(
            select(func.count(Doctor.id)).where(Doctor.clinic_id == c.id)
        )).scalar_one()

        # Bookings last 30 days
        bookings_30d = (await db.execute(
            select(Booking).where(
                Booking.clinic_id == c.id,
                Booking.created_at >= thirty_days_ago,
            )
        )).scalars().all()

        revenue = sum(float(b.total_amount or 0) for b in bookings_30d if b.status in ("confirmed", "completed", "payment_received"))

        result.append(ClinicListItem(
            id=str(c.id),
            name=c.name,
            slug=c.slug,
            tier=c.tier,
            is_active=c.is_active,
            doctor_count=doc_count,
            booking_count_30d=len(bookings_30d),
            revenue_30d=round(revenue, 2),
            outcome_enrolled=c.outcome_enrolled,
        ))

    return result


@router.patch("/clinics/{clinic_id}/tier")
async def upgrade_tier(
    clinic_id: str,
    body: TierUpgrade,
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    clinic = await db.get(ClinicFeatureStore, uuid.UUID(clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    clinic.tier = body.tier
    clinic.updated_at = datetime.now(timezone.utc)

    # Update all doctors at this clinic to same tier
    doctors = (await db.execute(
        select(Doctor).where(Doctor.clinic_id == clinic.id)
    )).scalars().all()
    for d in doctors:
        d.tier = body.tier
        d.updated_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "clinic_id": clinic_id,
        "tier": body.tier,
        "doctors_updated": len(doctors),
        "notes": body.notes,
    }


@router.patch("/clinics/{clinic_id}/activate")
async def activate_clinic(
    clinic_id: str,
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    clinic = await db.get(ClinicFeatureStore, uuid.UUID(clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.is_active = True
    clinic.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"clinic_id": clinic_id, "is_active": True}


@router.patch("/clinics/{clinic_id}/deactivate")
async def deactivate_clinic(
    clinic_id: str,
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    clinic = await db.get(ClinicFeatureStore, uuid.UUID(clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.is_active = False
    clinic.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"clinic_id": clinic_id, "is_active": False}


@router.get("/stats", response_model=PlatformStats)
async def platform_stats(
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    total_clinics = (await db.execute(select(func.count(ClinicFeatureStore.id)))).scalar_one()
    total_doctors = (await db.execute(select(func.count(Doctor.id)))).scalar_one()
    total_bookings = (await db.execute(select(func.count(Booking.id)))).scalar_one()

    # GMV = total booking amounts
    gmv_result = await db.execute(select(func.sum(Booking.total_amount)))
    total_gmv = float(gmv_result.scalar_one() or 0)

    # Revenue = total commission amounts
    rev_result = await db.execute(select(func.sum(Booking.commission_amount)))
    total_revenue = float(rev_result.scalar_one() or 0)

    return PlatformStats(
        total_clinics=total_clinics,
        total_doctors=total_doctors,
        total_bookings=total_bookings,
        total_gmv=round(total_gmv, 2),
        total_revenue=round(total_revenue, 2),
    )
