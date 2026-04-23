"""
api/clinics.py — Clinic list and profile endpoints.

GET /api/clinics — filtered list
GET /api/clinics/{slug} — full profile with team, packages, reviews
GET /api/clinics/search?q=&lang=en — full-text search
"""

from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import any_, cast, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import Float

from core.pricing import INR_PER_USD_FALLBACK, retreat_effective_inr
from db.cache import cache_get, cache_set
from db.database import get_db
from db.models import ClinicFeatureStore, ClinicTeam, Retreat, RetreatAvailability, Review, Room


router = APIRouter(prefix="/api/clinics", tags=["clinics"])

_CACHE_TTL = 60


# Pydantic models

class TeamMemberOut(BaseModel):
    id: str
    name: str
    qualification: str | None
    years_experience: int | None
    photo_url: str | None

class RetreatInline(BaseModel):
    id: str
    name: str
    description: str | None
    package_type: str | None
    wellness_categories: list[str]
    duration_min_days: int | None
    duration_max_days: int | None
    price_usd: float | None
    """Legacy USD list price from DB (optional reference)."""
    price_inr: float
    """Effective package price in INR (listed INR or converted from USD)."""
    includes_accommodation: bool
    includes_meals: bool
    includes_transfers: bool
    max_guests_per_slot: int | None

class ReviewOut(BaseModel):
    id: str
    rating: int
    review_text: str | None
    reviewer_location: str | None
    treatment_slug: str | None
    retreat_id: str | None
    retreat_name: str | None
    verified: bool
    created_at: datetime

class ClinicSummary(BaseModel):
    id: str
    slug: str
    name: str
    tier: int
    district: str | None
    rating: float | None
    review_count: int
    wellness_categories: list[str]
    languages: list[str]
    pricing_min: float | None
    certifications: list[str]
    atmosphere: list[str]
    outcome_enrolled: bool
    accommodation_available: bool
    photos: list[str]
    retreat_count: int
    cheapest_price: float | None
    """Minimum active retreat price in INR (canonical for guests)."""

class ClinicDetail(BaseModel):
    id: str
    slug: str
    name: str
    tier: int
    district: str | None
    rating: float | None
    review_count: int
    wellness_categories: list[str]
    specialisations: list[str]
    languages: list[str]
    pricing_min: float | None
    pricing_max: float | None
    certifications: list[str]
    atmosphere: list[str]
    outcome_enrolled: bool
    accommodation_available: bool
    photos: list[str]
    address: str | None
    transport_info: str | None
    description: str | None
    phone: str | None
    email: str | None
    website_url: str | None
    lat: float | None
    lng: float | None
    # Operational info
    operating_hours: dict | None
    social_links: dict | None
    pickup_available: bool
    pickup_locations: list[str]
    # Enriched detail
    established_year: int | None
    highlights: list[str]
    accommodation_types: list[str]
    meal_options: list[str]
    nearest_airport: str | None
    nearest_railway: str | None
    patient_capacity: int | None
    team: list[TeamMemberOut]
    retreats: list[RetreatInline]
    reviews: list[ReviewOut]
    is_active: bool = True

class ClinicListResponse(BaseModel):
    items: list[ClinicSummary]
    total: int
    limit: int
    offset: int


# GET /api/clinics
@router.get("", response_model=ClinicListResponse)
async def list_clinics(
    wellness_category: str | None = Query(default=None),
    package_type: str | None = Query(default=None),
    price_min: float | None = Query(default=None, ge=0),
    price_max: float | None = Query(default=None, ge=0),
    duration_days: int | None = Query(default=None, ge=1),
    district: str | None = Query(default=None),
    language: str | None = Query(default=None),
    tier: int | None = Query(default=None, ge=1, le=2),
    rating_min: float | None = Query(default=None, ge=1.0, le=5.0),
    atmosphere: str | None = Query(default=None),
    check_in: date | None = Query(default=None),
    check_out: date | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    base_where = [ClinicFeatureStore.is_active.is_(True)]

    base = select(ClinicFeatureStore).where(*base_where)
    if tier is not None:
        base = base.where(ClinicFeatureStore.tier == tier)
    if wellness_category:
        base = base.where(wellness_category == any_(ClinicFeatureStore.wellness_categories))
    if language:
        base = base.where(language == any_(ClinicFeatureStore.languages))
    if district:
        base = base.where(ClinicFeatureStore.district.ilike(f"%{district}%"))
    if rating_min is not None:
        base = base.where(ClinicFeatureStore.rating >= rating_min)
    if atmosphere:
        base = base.where(atmosphere == any_(ClinicFeatureStore.atmosphere))
    if check_in is not None:
        # Keep only clinics that have at least one retreat with an available slot
        # on or after check_in (and on or before check_out if provided).
        avail_subq = (
            select(Retreat.clinic_id)
            .join(RetreatAvailability, RetreatAvailability.retreat_id == Retreat.id)
            .where(
                Retreat.is_active.is_(True),
                RetreatAvailability.is_blocked.is_(False),
                RetreatAvailability.available_spots > 0,
                RetreatAvailability.date >= check_in,
                *([RetreatAvailability.date <= check_out] if check_out else []),
            )
            .distinct()
            .subquery()
        )
        base = base.where(ClinicFeatureStore.id.in_(select(avail_subq)))

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    clinics = (await db.execute(
        base.order_by(ClinicFeatureStore.tier.desc(), ClinicFeatureStore.rating.desc().nulls_last())
        .limit(limit).offset(offset)
    )).scalars().all()

    _eff_inr = func.coalesce(
        Retreat.price_inr,
        cast(Retreat.price_usd, Float) * literal(INR_PER_USD_FALLBACK),
    )
    cheap_rows = (
        await db.execute(
            select(Retreat.clinic_id, func.min(_eff_inr))
            .where(Retreat.is_active.is_(True))
            .group_by(Retreat.clinic_id)
        )
    ).all()
    cheapest_by_clinic = {row[0]: float(row[1]) for row in cheap_rows if row[1] is not None}

    retreat_counts = (
        await db.execute(
            select(Retreat.clinic_id, func.count(Retreat.id))
            .where(Retreat.is_active.is_(True))
            .group_by(Retreat.clinic_id)
        )
    ).all()
    count_by_clinic = {row[0]: int(row[1]) for row in retreat_counts}

    items = []
    for c in clinics:
        items.append(ClinicSummary(
            id=str(c.id), slug=c.slug, name=c.name, tier=c.tier,
            district=c.district,
            rating=float(c.rating) if c.rating is not None else None,
            review_count=c.review_count,
            wellness_categories=c.wellness_categories or [],
            languages=c.languages or [],
            pricing_min=float(c.pricing_min) if c.pricing_min is not None else None,
            certifications=c.certifications or [],
            atmosphere=c.atmosphere or [],
            outcome_enrolled=c.outcome_enrolled,
            accommodation_available=c.accommodation_available,
            photos=c.photos or [],
            retreat_count=count_by_clinic.get(c.id, 0),
            cheapest_price=cheapest_by_clinic.get(c.id),
        ))

    return ClinicListResponse(items=items, total=total, limit=limit, offset=offset)


# GET /api/clinics/search
@router.get("/search")
async def search_clinics(
    q: str = Query(..., min_length=1, max_length=200),
    lang: str = Query(default="en"),
    db: AsyncSession = Depends(get_db),
):
    pattern = f"%{q}%"
    clinics = (await db.execute(
        select(ClinicFeatureStore).where(
            ClinicFeatureStore.is_active.is_(True),
            ClinicFeatureStore.name.ilike(pattern) |
            ClinicFeatureStore.district.ilike(pattern) |
            ClinicFeatureStore.description_en.ilike(pattern)
        ).order_by(ClinicFeatureStore.tier.desc(), ClinicFeatureStore.rating.desc().nulls_last())
        .limit(20)
    )).scalars().all()

    return [
        {
            "id": str(c.id), "slug": c.slug, "name": c.name,
            "tier": c.tier, "district": c.district,
            "rating": float(c.rating) if c.rating else None,
        }
        for c in clinics
    ]


# GET /api/clinics/{slug}
@router.get("/{slug}", response_model=ClinicDetail)
async def get_clinic(
    slug: str,
    lang: str = Query(default="en"),
    preview: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
):
    # Only use cache for live (non-preview) requests
    cache_key = f"clinic:{slug}:{lang}"
    if not preview:
        cached = await cache_get(cache_key)
        if cached is not None:
            return ClinicDetail.model_validate(cached)

    # Preview bypasses is_active filter so super admin can see draft clinics
    clinic_q = select(ClinicFeatureStore).where(ClinicFeatureStore.slug == slug)
    if not preview:
        clinic_q = clinic_q.where(ClinicFeatureStore.is_active.is_(True))

    clinic = (await db.execute(clinic_q)).scalar_one_or_none()

    if clinic is None:
        raise HTTPException(status_code=404, detail=f"Clinic '{slug}' not found.")

    # Team members
    team_rows = (await db.execute(
        select(ClinicTeam).where(ClinicTeam.clinic_id == clinic.id, ClinicTeam.is_active.is_(True))
        .order_by(ClinicTeam.display_order)
    )).scalars().all()

    team = [
        TeamMemberOut(
            id=str(t.id), name=t.name, qualification=t.qualification,
            years_experience=t.years_experience, photo_url=t.photo_url,
        )
        for t in team_rows
    ]

    # Retreats
    retreat_rows = (await db.execute(
        select(Retreat).where(Retreat.clinic_id == clinic.id, Retreat.is_active.is_(True))
        .order_by(Retreat.display_order)
    )).scalars().all()

    retreats = [
        RetreatInline(
            id=str(r.id), name=r.name, description=r.description_en,
            package_type=r.package_type,
            wellness_categories=r.wellness_categories or [],
            duration_min_days=r.duration_min_days, duration_max_days=r.duration_max_days,
            price_usd=float(r.price_usd) if r.price_usd is not None else None,
            price_inr=retreat_effective_inr(
                float(r.price_inr) if r.price_inr is not None else None,
                float(r.price_usd) if r.price_usd is not None else None,
            ),
            includes_accommodation=r.includes_accommodation, includes_meals=r.includes_meals,
            includes_transfers=r.includes_transfers, max_guests_per_slot=r.max_guests_per_slot,
        )
        for r in retreat_rows
    ]

    # Reviews — all verified, joined with retreat for name
    review_rows = (await db.execute(
        select(Review, Retreat)
        .outerjoin(Retreat, Review.retreat_id == Retreat.id)
        .where(Review.clinic_id == clinic.id, Review.verified.is_(True))
        .order_by(Review.created_at.desc())
        .limit(50)
    )).all()

    reviews = [
        ReviewOut(
            id=str(r.id), rating=r.rating, review_text=r.review_text,
            reviewer_location=r.reviewer_location, treatment_slug=r.treatment_slug,
            retreat_id=str(r.retreat_id) if r.retreat_id else None,
            retreat_name=(rt.name_display_en or rt.name) if rt else None,
            verified=r.verified, created_at=r.created_at,
        )
        for r, rt in review_rows
    ]

    description = clinic.description_ml if lang == "ml" else clinic.description_en

    result = ClinicDetail(
        id=str(clinic.id), slug=clinic.slug, name=clinic.name, tier=clinic.tier,
        district=clinic.district,
        rating=float(clinic.rating) if clinic.rating is not None else None,
        review_count=clinic.review_count,
        wellness_categories=clinic.wellness_categories or [],
        specialisations=clinic.specialisations or [],
        languages=clinic.languages or [],
        pricing_min=float(clinic.pricing_min) if clinic.pricing_min is not None else None,
        pricing_max=float(clinic.pricing_max) if clinic.pricing_max is not None else None,
        certifications=clinic.certifications or [],
        atmosphere=clinic.atmosphere or [],
        outcome_enrolled=clinic.outcome_enrolled,
        accommodation_available=clinic.accommodation_available,
        photos=clinic.photos or [],
        address=clinic.address, transport_info=clinic.transport_info,
        description=description, phone=clinic.phone, email=clinic.email,
        website_url=clinic.website_url, lat=clinic.lat, lng=clinic.lng,
        operating_hours=clinic.operating_hours,
        social_links=clinic.social_links,
        pickup_available=clinic.pickup_available,
        pickup_locations=clinic.pickup_locations or [],
        established_year=clinic.established_year,
        highlights=clinic.highlights or [],
        accommodation_types=clinic.accommodation_types or [],
        meal_options=clinic.meal_options or [],
        nearest_airport=clinic.nearest_airport,
        nearest_railway=clinic.nearest_railway,
        patient_capacity=clinic.patient_capacity,
        team=team, retreats=retreats, reviews=reviews,
        is_active=clinic.is_active,
    )

    if not preview:
        await cache_set(cache_key, result.model_dump(mode="json"), ttl=_CACHE_TTL)
    return result


class RoomPublicOut(BaseModel):
    id: str
    name: str
    category: str
    description: str | None
    price_per_night_inr: float
    amenities: list[str]
    photos: list[str]
    max_occupancy: int
    display_order: int


@router.get("/{slug}/rooms", response_model=list[RoomPublicOut])
async def list_clinic_rooms(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Return active rooms for a clinic (used by the booking page)."""
    clinic = (await db.execute(
        select(ClinicFeatureStore).where(
            ClinicFeatureStore.slug == slug,
            ClinicFeatureStore.is_active.is_(True),
        )
    )).scalar_one_or_none()
    if clinic is None:
        raise HTTPException(status_code=404, detail=f"Clinic '{slug}' not found.")

    rows = (await db.execute(
        select(Room)
        .where(Room.clinic_id == clinic.id, Room.is_active.is_(True))
        .order_by(Room.display_order, Room.created_at)
    )).scalars().all()

    return [
        RoomPublicOut(
            id=str(r.id),
            name=r.name,
            category=r.category,
            description=r.description,
            price_per_night_inr=float(r.price_per_night_inr),
            amenities=r.amenities or [],
            photos=r.photos or [],
            max_occupancy=r.max_occupancy,
            display_order=r.display_order,
        )
        for r in rows
    ]
