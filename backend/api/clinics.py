"""
api/clinics.py — Clinic list and profile endpoints.

GET /api/clinics — filtered list
GET /api/clinics/{slug} — full profile with team, packages, reviews
GET /api/clinics/search?q=&lang=en — full-text search
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import any_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.cache import cache_get, cache_set
from db.database import get_db
from db.models import ClinicFeatureStore, ClinicTeam, WellnessPackage, Review

router = APIRouter(prefix="/api/clinics", tags=["clinics"])

_CACHE_TTL = 60


# Pydantic models

class TeamMemberOut(BaseModel):
    id: str
    name: str
    qualification: str | None
    years_experience: int | None
    photo_url: str | None

class PackageInline(BaseModel):
    id: str
    name: str
    package_type: str
    wellness_categories: list[str]
    duration_min_days: int
    duration_max_days: int
    price_usd: float
    includes_accommodation: bool
    includes_meals: bool

class ReviewOut(BaseModel):
    id: str
    rating: int
    review_text: str | None
    reviewer_location: str | None
    treatment_slug: str | None
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
    outcome_enrolled: bool
    accommodation_available: bool
    photos: list[str]
    package_count: int
    cheapest_price: float | None

class ClinicDetail(BaseModel):
    id: str
    slug: str
    name: str
    tier: int
    district: str | None
    rating: float | None
    review_count: int
    wellness_categories: list[str]
    languages: list[str]
    certifications: list[str]
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
    team: list[TeamMemberOut]
    packages: list[PackageInline]
    reviews: list[ReviewOut]

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

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    clinics = (await db.execute(
        base.order_by(ClinicFeatureStore.tier.desc(), ClinicFeatureStore.rating.desc().nulls_last())
        .limit(limit).offset(offset)
    )).scalars().all()

    items = []
    for c in clinics:
        # Get package count and cheapest price
        pkg_stats = (await db.execute(
            select(func.count(WellnessPackage.id), func.min(WellnessPackage.price_usd))
            .where(WellnessPackage.clinic_id == c.id, WellnessPackage.is_active.is_(True))
        )).one()

        items.append(ClinicSummary(
            id=str(c.id), slug=c.slug, name=c.name, tier=c.tier,
            district=c.district,
            rating=float(c.rating) if c.rating is not None else None,
            review_count=c.review_count,
            wellness_categories=c.wellness_categories or [],
            languages=c.languages or [],
            pricing_min=float(c.pricing_min) if c.pricing_min is not None else None,
            certifications=c.certifications or [],
            outcome_enrolled=c.outcome_enrolled,
            accommodation_available=c.accommodation_available,
            photos=c.photos or [],
            package_count=pkg_stats[0],
            cheapest_price=float(pkg_stats[1]) if pkg_stats[1] is not None else None,
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
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"clinic:{slug}:{lang}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return ClinicDetail.model_validate(cached)

    clinic = (await db.execute(
        select(ClinicFeatureStore).where(ClinicFeatureStore.slug == slug, ClinicFeatureStore.is_active.is_(True))
    )).scalar_one_or_none()

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

    # Packages
    pkg_rows = (await db.execute(
        select(WellnessPackage).where(WellnessPackage.clinic_id == clinic.id, WellnessPackage.is_active.is_(True))
        .order_by(WellnessPackage.display_order)
    )).scalars().all()

    packages = [
        PackageInline(
            id=str(p.id), name=p.name, package_type=p.package_type,
            wellness_categories=p.wellness_categories or [],
            duration_min_days=p.duration_min_days, duration_max_days=p.duration_max_days,
            price_usd=float(p.price_usd),
            includes_accommodation=p.includes_accommodation, includes_meals=p.includes_meals,
        )
        for p in pkg_rows
    ]

    # Reviews
    review_rows = (await db.execute(
        select(Review).where(Review.clinic_id == clinic.id, Review.verified.is_(True))
        .order_by(Review.created_at.desc()).limit(5)
    )).scalars().all()

    reviews = [
        ReviewOut(
            id=str(r.id), rating=r.rating, review_text=r.review_text,
            reviewer_location=r.reviewer_location, treatment_slug=r.treatment_slug,
            verified=r.verified, created_at=r.created_at,
        )
        for r in review_rows
    ]

    description = clinic.description_ml if lang == "ml" else clinic.description_en

    result = ClinicDetail(
        id=str(clinic.id), slug=clinic.slug, name=clinic.name, tier=clinic.tier,
        district=clinic.district,
        rating=float(clinic.rating) if clinic.rating is not None else None,
        review_count=clinic.review_count,
        wellness_categories=clinic.wellness_categories or [],
        languages=clinic.languages or [],
        certifications=clinic.certifications or [],
        outcome_enrolled=clinic.outcome_enrolled,
        accommodation_available=clinic.accommodation_available,
        photos=clinic.photos or [],
        address=clinic.address, transport_info=clinic.transport_info,
        description=description, phone=clinic.phone, email=clinic.email,
        website_url=clinic.website_url, lat=clinic.lat, lng=clinic.lng,
        team=team, packages=packages, reviews=reviews,
    )

    await cache_set(cache_key, result.model_dump(mode="json"), ttl=_CACHE_TTL)
    return result
