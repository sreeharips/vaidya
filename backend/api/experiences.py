"""
api/experiences.py — Public experiences endpoints.

GET /api/retreats/{retreat_id}/experiences
  Returns platform-curated experiences (proximity-matched) + clinic add-ons.

GET /api/experiences/{experience_id}
  Returns full experience detail + nearby experiences + nearby retreats.
"""

import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.geo import filter_by_radius, haversine_km
from db.database import get_db
from db.models import ClinicExperience, ClinicFeatureStore, Experience, Retreat
from db.outcomes import append_outcome

router = APIRouter(tags=["experiences"])


# ── Pydantic response schemas ─────────────────────────────────────────────────

class PlatformExperienceOut(BaseModel):
    id: str
    name_en: str
    name_ar: str | None
    name_ml: str | None
    description_en: str | None
    category: str
    lat: float | None
    lng: float | None
    district: str | None
    region_label: str | None
    typical_duration_hours: float | None
    price_inr: float
    is_free: bool
    photos: list[str]
    external_url: str | None
    distance_km: float | None


class NearbyRetreatOut(BaseModel):
    id: str
    name: str
    clinic_name: str
    clinic_slug: str
    district: str | None
    rating: float | None
    review_count: int
    price_usd: float
    price_inr: float | None
    duration_min_days: int
    duration_max_days: int
    photos: list[str]
    distance_km: float | None


class ExperienceDetailOut(BaseModel):
    id: str
    name_en: str
    name_ar: str | None
    name_ml: str | None
    description_en: str | None
    description_ar: str | None
    description_ml: str | None
    category: str
    lat: float | None
    lng: float | None
    district: str | None
    region_label: str | None
    typical_duration_hours: float | None
    price_inr: float
    is_free: bool
    photos: list[str]
    external_url: str | None
    nearby_experiences: list[PlatformExperienceOut]
    nearby_retreats: list[NearbyRetreatOut]


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

@router.get("/api/retreats/{retreat_id}/experiences", response_model=RetreatExperiencesResponse)
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
                lat=exp.lat,
                lng=exp.lng,
                district=exp.district,
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
                        lat=exp.lat,
                        lng=exp.lng,
                        district=exp.district,
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


# ── Experience detail page ────────────────────────────────────────────────────

@router.get("/api/experiences/{experience_id}", response_model=ExperienceDetailOut)
async def get_experience_detail(
    experience_id: str,
    db: AsyncSession = Depends(get_db),
) -> ExperienceDetailOut:
    try:
        eid = uuid.UUID(experience_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid experience ID")

    result = await db.execute(
        select(Experience).where(Experience.id == eid, Experience.is_active.is_(True))
    )
    exp = result.scalar_one_or_none()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experience not found")

    # All active experiences for nearby matching
    all_result = await db.execute(
        select(Experience).where(Experience.is_active.is_(True), Experience.id != eid)
    )
    all_experiences = all_result.scalars().all()

    # ── Nearby experiences ────────────────────────────────────────────────────
    nearby_exps: list[PlatformExperienceOut] = []
    if exp.lat is not None and exp.lng is not None:
        nearby_pairs = filter_by_radius(all_experiences, exp.lat, exp.lng, radius_km=60.0)
        nearby_exps = [
            PlatformExperienceOut(
                id=str(e.id),
                name_en=e.name_en,
                name_ar=e.name_ar,
                name_ml=e.name_ml,
                description_en=e.description_en,
                category=e.category,
                lat=e.lat,
                lng=e.lng,
                district=e.district,
                region_label=e.region_label,
                typical_duration_hours=e.typical_duration_hours,
                price_inr=float(e.price_inr),
                is_free=e.is_free,
                photos=e.photos or [],
                external_url=e.external_url,
                distance_km=dist,
            )
            for e, dist in nearby_pairs[:6]
        ]
    elif exp.district:
        for e in all_experiences:
            if e.district and e.district.lower() == exp.district.lower():
                nearby_exps.append(PlatformExperienceOut(
                    id=str(e.id),
                    name_en=e.name_en,
                    name_ar=e.name_ar,
                    name_ml=e.name_ml,
                    description_en=e.description_en,
                    category=e.category,
                    lat=e.lat,
                    lng=e.lng,
                    district=e.district,
                    region_label=e.region_label,
                    typical_duration_hours=e.typical_duration_hours,
                    price_inr=float(e.price_inr),
                    is_free=e.is_free,
                    photos=e.photos or [],
                    external_url=e.external_url,
                    distance_km=None,
                ))
            if len(nearby_exps) >= 6:
                break

    # ── Nearby retreats ───────────────────────────────────────────────────────
    clinic_result = await db.execute(
        select(ClinicFeatureStore, Retreat)
        .join(Retreat, Retreat.clinic_id == ClinicFeatureStore.id)
        .where(ClinicFeatureStore.is_active.is_(True), Retreat.is_active.is_(True))
        .order_by(ClinicFeatureStore.rating.desc().nullslast())
    )
    all_clinic_retreats = clinic_result.all()

    nearby_retreats: list[NearbyRetreatOut] = []
    seen_clinics: set = set()
    if exp.lat is not None and exp.lng is not None:
        # Sort clinics by distance
        clinic_distances: list[tuple[ClinicFeatureStore, Retreat, float]] = []
        for clinic, retreat in all_clinic_retreats:
            if clinic.lat is not None and clinic.lng is not None:
                dist = haversine_km(exp.lat, exp.lng, clinic.lat, clinic.lng)
                if dist <= 80.0:
                    clinic_distances.append((clinic, retreat, dist))
        clinic_distances.sort(key=lambda x: x[2])
        for clinic, retreat, dist in clinic_distances:
            if clinic.id in seen_clinics:
                continue
            seen_clinics.add(clinic.id)
            nearby_retreats.append(NearbyRetreatOut(
                id=str(retreat.id),
                name=retreat.name_display_en or retreat.name,
                clinic_name=clinic.name,
                clinic_slug=clinic.slug,
                district=clinic.district,
                rating=clinic.rating,
                review_count=clinic.review_count or 0,
                price_usd=float(retreat.price_usd),
                price_inr=float(retreat.price_inr) if retreat.price_inr else None,
                duration_min_days=retreat.duration_min_days,
                duration_max_days=retreat.duration_max_days,
                photos=clinic.photos or [],
                distance_km=round(dist, 1),
            ))
            if len(nearby_retreats) >= 4:
                break
    else:
        # District fallback
        for clinic, retreat in all_clinic_retreats:
            if clinic.id in seen_clinics:
                continue
            if exp.district and clinic.district and clinic.district.lower() == exp.district.lower():
                seen_clinics.add(clinic.id)
                nearby_retreats.append(NearbyRetreatOut(
                    id=str(retreat.id),
                    name=retreat.name_display_en or retreat.name,
                    clinic_name=clinic.name,
                    clinic_slug=clinic.slug,
                    district=clinic.district,
                    rating=clinic.rating,
                    review_count=clinic.review_count or 0,
                    price_usd=float(retreat.price_usd),
                    price_inr=float(retreat.price_inr) if retreat.price_inr else None,
                    duration_min_days=retreat.duration_min_days,
                    duration_max_days=retreat.duration_max_days,
                    photos=clinic.photos or [],
                    distance_km=None,
                ))
            if len(nearby_retreats) >= 4:
                break

    return ExperienceDetailOut(
        id=str(exp.id),
        name_en=exp.name_en,
        name_ar=exp.name_ar,
        name_ml=exp.name_ml,
        description_en=exp.description_en,
        description_ar=exp.description_ar,
        description_ml=exp.description_ml,
        category=exp.category,
        lat=exp.lat,
        lng=exp.lng,
        district=exp.district,
        region_label=exp.region_label,
        typical_duration_hours=exp.typical_duration_hours,
        price_inr=float(exp.price_inr),
        is_free=exp.is_free,
        photos=exp.photos or [],
        external_url=exp.external_url,
        nearby_experiences=nearby_exps,
        nearby_retreats=nearby_retreats,
    )


# ── Experience list (for home page + clinic page) ─────────────────────────────

@router.get("/api/experiences", response_model=list[PlatformExperienceOut])
async def list_experiences(
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
    district: str | None = Query(default=None),
    category: str | None = Query(default=None),
    limit: int = Query(default=12, le=50),
    db: AsyncSession = Depends(get_db),
) -> list[PlatformExperienceOut]:
    """Return active experiences, optionally filtered/sorted by proximity."""
    stmt = select(Experience).where(Experience.is_active.is_(True))
    if category:
        stmt = stmt.where(Experience.category == category)
    result = await db.execute(stmt)
    all_exps = result.scalars().all()

    out: list[PlatformExperienceOut] = []

    if lat is not None and lng is not None:
        nearby = filter_by_radius(all_exps, lat, lng, radius_km=80.0)
        out = [
            PlatformExperienceOut(
                id=str(e.id), name_en=e.name_en, name_ar=e.name_ar, name_ml=e.name_ml,
                description_en=e.description_en, category=e.category,
                lat=e.lat, lng=e.lng, district=e.district, region_label=e.region_label,
                typical_duration_hours=e.typical_duration_hours,
                price_inr=float(e.price_inr), is_free=e.is_free,
                photos=e.photos or [], external_url=e.external_url, distance_km=dist,
            )
            for e, dist in nearby[:limit]
        ]
    elif district:
        dl = district.lower()
        for e in all_exps:
            if e.district and e.district.lower() == dl:
                out.append(PlatformExperienceOut(
                    id=str(e.id), name_en=e.name_en, name_ar=e.name_ar, name_ml=e.name_ml,
                    description_en=e.description_en, category=e.category,
                    lat=e.lat, lng=e.lng, district=e.district, region_label=e.region_label,
                    typical_duration_hours=e.typical_duration_hours,
                    price_inr=float(e.price_inr), is_free=e.is_free,
                    photos=e.photos or [], external_url=e.external_url, distance_km=None,
                ))
            if len(out) >= limit:
                break
    else:
        out = [
            PlatformExperienceOut(
                id=str(e.id), name_en=e.name_en, name_ar=e.name_ar, name_ml=e.name_ml,
                description_en=e.description_en, category=e.category,
                lat=e.lat, lng=e.lng, district=e.district, region_label=e.region_label,
                typical_duration_hours=e.typical_duration_hours,
                price_inr=float(e.price_inr), is_free=e.is_free,
                photos=e.photos or [], external_url=e.external_url, distance_km=None,
            )
            for e in all_exps[:limit]
        ]

    return out
