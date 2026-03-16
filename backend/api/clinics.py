"""
api/clinics.py — Clinic list and profile endpoints.

GET /api/clinics?tier=&specialisation=&language=&prakriti=&district=&budget_max=&rating_min=&limit=20&offset=0
GET /api/clinics/{slug}
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import any_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.cache import cache_get, cache_set
from db.database import get_db
from db.models import ClinicFeatureStore, Doctor, Review, Treatment

router = APIRouter(prefix="/api/clinics", tags=["clinics"])

_CACHE_TTL = 60  # seconds


# ── Pydantic models ───────────────────────────────────────────────────────────


class TreatmentInline(BaseModel):
    id: str
    slug: str
    name: str
    duration_min_days: int | None
    duration_max_days: int | None
    price_per_day: float | None
    included_therapies: list[str]
    prakriti_tags: list[str]
    doctor_id: str | None
    doctor_name: str | None


class DoctorAtClinic(BaseModel):
    id: str
    slug: str
    name: str
    qualification: str
    years_exp: int
    tier: int
    rating: float | None
    review_count: int
    specialisations: list[str]
    prakriti_affinities: list[str]
    languages: list[str]
    photo_url: str | None


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
    specialisations: list[str]
    prakriti_affinities: list[str]
    languages: list[str]
    pricing_min: float | None
    pricing_max: float | None
    certifications: list[str]
    outcome_enrolled: bool
    accommodation_available: bool
    photos: list[str]


class ClinicDetail(BaseModel):
    id: str
    slug: str
    name: str
    tier: int
    district: str | None
    rating: float | None
    review_count: int
    specialisations: list[str]
    prakriti_affinities: list[str]
    languages: list[str]
    pricing_min: float | None
    pricing_max: float | None
    certifications: list[str]
    outcome_enrolled: bool
    accommodation_available: bool
    photos: list[str]
    address: str | None
    transport_info: str | None
    lat: float | None
    lng: float | None
    doctors: list[DoctorAtClinic]
    treatments: list[TreatmentInline]
    reviews: list[ReviewOut]


class ClinicListResponse(BaseModel):
    items: list[ClinicSummary]
    total: int
    limit: int
    offset: int


# ── Helpers ───────────────────────────────────────────────────────────────────


def _apply_clinic_filters(stmt, *, tier, specialisation, language, prakriti, district, budget_max, rating_min):
    """Append WHERE clauses to *stmt* for each non-None filter."""
    if tier is not None:
        stmt = stmt.where(ClinicFeatureStore.tier == tier)
    if specialisation:
        stmt = stmt.where(specialisation == any_(ClinicFeatureStore.specialisations))
    if language:
        stmt = stmt.where(language == any_(ClinicFeatureStore.languages))
    if prakriti:
        stmt = stmt.where(prakriti == any_(ClinicFeatureStore.prakriti_affinities))
    if district:
        stmt = stmt.where(ClinicFeatureStore.district.ilike(f"%{district}%"))
    if budget_max is not None:
        # pricing_min is the entry-level price — filter clinics affordable at that price
        stmt = stmt.where(ClinicFeatureStore.pricing_min <= budget_max)
    if rating_min is not None:
        stmt = stmt.where(ClinicFeatureStore.rating >= rating_min)
    return stmt


def _clinic_summary(c: ClinicFeatureStore) -> ClinicSummary:
    return ClinicSummary(
        id=str(c.id),
        slug=c.slug,
        name=c.name,
        tier=c.tier,
        district=c.district,
        rating=float(c.rating) if c.rating is not None else None,
        review_count=c.review_count,
        specialisations=c.specialisations or [],
        prakriti_affinities=c.prakriti_affinities or [],
        languages=c.languages or [],
        pricing_min=float(c.pricing_min) if c.pricing_min is not None else None,
        pricing_max=float(c.pricing_max) if c.pricing_max is not None else None,
        certifications=c.certifications or [],
        outcome_enrolled=c.outcome_enrolled,
        accommodation_available=c.accommodation_available,
        photos=c.photos or [],
    )


# ── GET /api/clinics ──────────────────────────────────────────────────────────


@router.get("", response_model=ClinicListResponse)
async def list_clinics(
    tier: int | None = Query(default=None, ge=1, le=2),
    specialisation: str | None = Query(default=None, max_length=100),
    language: str | None = Query(default=None, max_length=5),
    prakriti: str | None = Query(default=None, max_length=50),
    district: str | None = Query(default=None, max_length=100),
    budget_max: float | None = Query(default=None, ge=0),
    rating_min: float | None = Query(default=None, ge=1.0, le=5.0),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Filtered, paginated list of clinics.

    All filters are optional and combinable. Results ordered by tier desc, rating desc.
    `budget_max` filters against `pricing_min` (the clinic's entry-level price).
    """
    base_where = [ClinicFeatureStore.is_active.is_(True)]

    base = select(ClinicFeatureStore).where(*base_where)
    base = _apply_clinic_filters(
        base,
        tier=tier,
        specialisation=specialisation,
        language=language,
        prakriti=prakriti,
        district=district,
        budget_max=budget_max,
        rating_min=rating_min,
    )

    count_stmt = select(func.count(ClinicFeatureStore.id)).where(*base_where)
    count_stmt = _apply_clinic_filters(
        count_stmt,
        tier=tier,
        specialisation=specialisation,
        language=language,
        prakriti=prakriti,
        district=district,
        budget_max=budget_max,
        rating_min=rating_min,
    )

    total = (await db.execute(count_stmt)).scalar_one()

    clinics = (
        await db.execute(
            base.order_by(ClinicFeatureStore.tier.desc(), ClinicFeatureStore.rating.desc().nulls_last())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()

    return ClinicListResponse(
        items=[_clinic_summary(c) for c in clinics],
        total=total,
        limit=limit,
        offset=offset,
    )


# ── GET /api/clinics/{slug} ───────────────────────────────────────────────────


@router.get("/{slug}", response_model=ClinicDetail)
async def get_clinic(
    slug: str,
    lang: str = Query(default="en", pattern="^(en|ar|de|fr|ml|hi)$"),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Full clinic profile: all fields, doctor roster, treatment programmes, last 5 reviews.

    Response is cached in Redis for 60 seconds (key: `clinic:{slug}:{lang}`).
    Cache is bypassed gracefully if Redis is unavailable.
    """
    cache_key = f"clinic:{slug}:{lang}"

    cached = await cache_get(cache_key)
    if cached is not None:
        return ClinicDetail.model_validate(cached)

    # ── Fetch clinic ──────────────────────────────────────────────────────────
    clinic = (
        await db.execute(
            select(ClinicFeatureStore)
            .where(ClinicFeatureStore.slug == slug, ClinicFeatureStore.is_active.is_(True))
        )
    ).scalar_one_or_none()

    if clinic is None:
        raise HTTPException(status_code=404, detail=f"Clinic '{slug}' not found.")

    # ── Doctors at this clinic ────────────────────────────────────────────────
    doctor_rows = (
        await db.execute(
            select(Doctor)
            .where(Doctor.clinic_id == clinic.id, Doctor.is_active.is_(True))
            .order_by(Doctor.tier.desc(), Doctor.rating.desc().nulls_last())
        )
    ).scalars().all()

    doctors = [
        DoctorAtClinic(
            id=str(d.id),
            slug=d.slug,
            name=d.name,
            qualification=d.qualification,
            years_exp=d.years_exp,
            tier=d.tier,
            rating=float(d.rating) if d.rating is not None else None,
            review_count=d.review_count,
            specialisations=d.specialisations or [],
            prakriti_affinities=d.prakriti_affinities or [],
            languages=d.languages or [],
            photo_url=d.photo_url,
        )
        for d in doctor_rows
    ]

    # ── Treatments at this clinic ─────────────────────────────────────────────
    # Join with doctor to surface the doctor name on each treatment
    treatment_rows = (
        await db.execute(
            select(Treatment, Doctor)
            .join(Doctor, Treatment.doctor_id == Doctor.id, isouter=True)
            .where(Treatment.clinic_id == clinic.id, Treatment.is_active.is_(True))
            .order_by(Treatment.price_per_day.asc().nulls_last())
        )
    ).all()

    treatments = [
        TreatmentInline(
            id=str(t.id),
            slug=t.slug,
            name=t.name,
            duration_min_days=t.duration_min_days,
            duration_max_days=t.duration_max_days,
            price_per_day=float(t.price_per_day) if t.price_per_day is not None else None,
            included_therapies=t.included_therapies or [],
            prakriti_tags=t.prakriti_tags or [],
            doctor_id=str(t.doctor_id) if t.doctor_id else None,
            doctor_name=doc.name if doc else None,
        )
        for t, doc in treatment_rows
    ]

    # ── Reviews (latest 5, verified only) ─────────────────────────────────────
    review_rows = (
        await db.execute(
            select(Review)
            .where(Review.clinic_id == clinic.id, Review.verified.is_(True))
            .order_by(Review.created_at.desc())
            .limit(5)
        )
    ).scalars().all()

    reviews = [
        ReviewOut(
            id=str(r.id),
            rating=r.rating,
            review_text=r.review_text,
            reviewer_location=r.reviewer_location,
            treatment_slug=r.treatment_slug,
            verified=r.verified,
            created_at=r.created_at,
        )
        for r in review_rows
    ]

    result = ClinicDetail(
        id=str(clinic.id),
        slug=clinic.slug,
        name=clinic.name,
        tier=clinic.tier,
        district=clinic.district,
        rating=float(clinic.rating) if clinic.rating is not None else None,
        review_count=clinic.review_count,
        specialisations=clinic.specialisations or [],
        prakriti_affinities=clinic.prakriti_affinities or [],
        languages=clinic.languages or [],
        pricing_min=float(clinic.pricing_min) if clinic.pricing_min is not None else None,
        pricing_max=float(clinic.pricing_max) if clinic.pricing_max is not None else None,
        certifications=clinic.certifications or [],
        outcome_enrolled=clinic.outcome_enrolled,
        accommodation_available=clinic.accommodation_available,
        photos=clinic.photos or [],
        address=clinic.address,
        transport_info=clinic.transport_info,
        lat=clinic.lat,
        lng=clinic.lng,
        doctors=doctors,
        treatments=treatments,
        reviews=reviews,
    )

    await cache_set(cache_key, result.model_dump(mode="json"), ttl=_CACHE_TTL)
    return result
