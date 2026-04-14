"""
api/experiences.py — Public experiences endpoint.

GET /api/retreats/{retreat_id}/experiences
  Returns platform-curated experiences (proximity-matched) + clinic add-ons.
"""

import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.geo import filter_by_radius
from db.database import get_db
from db.models import ClinicExperience, ClinicFeatureStore, Experience, Retreat
from db.outcomes import append_outcome

router = APIRouter(prefix="/api/retreats", tags=["experiences"])


# ── Pydantic response schemas ─────────────────────────────────────────────────

class PlatformExperienceOut(BaseModel):
    id: str
    name_en: str
    name_ar: str | None
    name_ml: str | None
    description_en: str | None
    category: str
    region_label: str | None
    typical_duration_hours: float | None
    price_inr: float
    is_free: bool
    photos: list[str]
    external_url: str | None
    distance_km: float | None


class ClinicAddOnOut(BaseModel):
    id: str
    name_en: str
    name_ar: str | None
    name_ml: str | None
    description_en: str | None
    category: str
    price_inr: float
    photos: list[str]
    max_per_booking: int
    display_order: int


class RetreatExperiencesResponse(BaseModel):
    platform_experiences: list[PlatformExperienceOut]
    clinic_add_ons: list[ClinicAddOnOut]


# ── Route ─────────────────────────────────────────────────────────────────────

@router.get("/{retreat_id}/experiences", response_model=RetreatExperiencesResponse)
async def get_retreat_experiences(
    retreat_id: str,
    db: AsyncSession = Depends(get_db),
) -> RetreatExperiencesResponse:
    try:
        rid = uuid.UUID(retreat_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid retreat ID")

    # Load retreat + clinic
    result = await db.execute(
        select(Retreat, ClinicFeatureStore)
        .join(ClinicFeatureStore, Retreat.clinic_id == ClinicFeatureStore.id)
        .where(Retreat.id == rid, Retreat.is_active.is_(True))
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Retreat not found")

    retreat, clinic = row

    # ── Clinic add-ons ────────────────────────────────────────────────────────
    addon_result = await db.execute(
        select(ClinicExperience)
        .where(
            ClinicExperience.clinic_id == clinic.id,
            ClinicExperience.is_active.is_(True),
        )
        .order_by(ClinicExperience.display_order, ClinicExperience.created_at)
    )
    clinic_add_ons = addon_result.scalars().all()

    # ── Platform experiences ──────────────────────────────────────────────────
    exp_result = await db.execute(
        select(Experience).where(Experience.is_active.is_(True))
    )
    all_experiences = exp_result.scalars().all()

    platform_out: list[PlatformExperienceOut] = []

    if clinic.lat is not None and clinic.lng is not None:
        # Primary: Haversine 50 km radius
        nearby = filter_by_radius(all_experiences, clinic.lat, clinic.lng, radius_km=50.0)
        platform_out = [
            PlatformExperienceOut(
                id=str(exp.id),
                name_en=exp.name_en,
                name_ar=exp.name_ar,
                name_ml=exp.name_ml,
                description_en=exp.description_en,
                category=exp.category,
                region_label=exp.region_label,
                typical_duration_hours=exp.typical_duration_hours,
                price_inr=float(exp.price_inr),
                is_free=exp.is_free,
                photos=exp.photos or [],
                external_url=exp.external_url,
                distance_km=dist,
            )
            for exp, dist in nearby
        ]
    elif clinic.district:
        # Fallback: district match
        clinic_district = clinic.district.lower()
        for exp in all_experiences:
            if exp.district and exp.district.lower() == clinic_district:
                platform_out.append(
                    PlatformExperienceOut(
                        id=str(exp.id),
                        name_en=exp.name_en,
                        name_ar=exp.name_ar,
                        name_ml=exp.name_ml,
                        description_en=exp.description_en,
                        category=exp.category,
                        region_label=exp.region_label,
                        typical_duration_hours=exp.typical_duration_hours,
                        price_inr=float(exp.price_inr),
                        is_free=exp.is_free,
                        photos=exp.photos or [],
                        external_url=exp.external_url,
                        distance_km=None,
                    )
                )

    # Fire outcome event non-blocking
    async def _log() -> None:
        async with db.begin_nested():
            await append_outcome(
                db,
                event_type="experience_viewed",
                clinic_id=clinic.id,
                scores={
                    "platform_count": len(platform_out),
                    "clinic_add_on_count": len(clinic_add_ons),
                    "retreat_id": str(retreat.id),
                },
            )

    asyncio.create_task(_log())

    return RetreatExperiencesResponse(
        platform_experiences=platform_out,
        clinic_add_ons=[
            ClinicAddOnOut(
                id=str(a.id),
                name_en=a.name_en,
                name_ar=a.name_ar,
                name_ml=a.name_ml,
                description_en=a.description_en,
                category=a.category,
                price_inr=float(a.price_inr),
                photos=a.photos or [],
                max_per_booking=a.max_per_booking,
                display_order=a.display_order,
            )
            for a in clinic_add_ons
        ],
    )
