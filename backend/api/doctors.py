"""
api/doctors.py — Doctor list and profile endpoints.

GET /api/doctors?tier=&specialisation=&language=&prakriti=&district=&budget_max=&rating_min=&limit=20&offset=0
GET /api/doctors/{slug}
"""

from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import any_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.cache import cache_get, cache_set
from db.database import get_db
from db.models import ClinicFeatureStore, Doctor, DoctorTreatment, Review, Treatment

router = APIRouter(prefix="/api/doctors", tags=["doctors"])

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


class ReviewOut(BaseModel):
    id: str
    rating: int
    review_text: str | None
    reviewer_location: str | None
    treatment_slug: str | None
    verified: bool
    created_at: datetime


class ClinicInline(BaseModel):
    id: str
    slug: str
    name: str
    district: str | None


class DoctorSummary(BaseModel):
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
    district: str | None      # resolved from clinic
    pricing_per_day: float | None
    photo_url: str | None
    clinic_id: str | None
    clinic_name: str | None
    clinic_slug: str | None


class DoctorDetail(BaseModel):
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
    district: str | None
    pricing_per_day: float | None
    photo_url: str | None
    patients_treated: int
    bio: str | None
    clinic: ClinicInline | None
    treatments: list[TreatmentInline]
    reviews: list[ReviewOut]
    next_available_date: date | None


class DoctorListResponse(BaseModel):
    items: list[DoctorSummary]
    total: int
    limit: int
    offset: int


# ── Helpers ───────────────────────────────────────────────────────────────────


def _apply_doctor_filters(stmt, *, tier, specialisation, language, prakriti, district, budget_max, rating_min):
    """Append WHERE clauses to *stmt* for each non-None filter."""
    if tier is not None:
        stmt = stmt.where(Doctor.tier == tier)
    if specialisation:
        stmt = stmt.where(specialisation == any_(Doctor.specialisations))
    if language:
        stmt = stmt.where(language == any_(Doctor.languages))
    if prakriti:
        stmt = stmt.where(prakriti == any_(Doctor.prakriti_affinities))
    if district:
        # district lives on the clinic — requires the join to already be present
        stmt = stmt.where(ClinicFeatureStore.district.ilike(f"%{district}%"))
    if budget_max is not None:
        stmt = stmt.where(Doctor.pricing_per_day <= budget_max)
    if rating_min is not None:
        stmt = stmt.where(Doctor.rating >= rating_min)
    return stmt


# ── GET /api/doctors ──────────────────────────────────────────────────────────


@router.get("", response_model=DoctorListResponse)
async def list_doctors(
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
    """Filtered, paginated list of doctors.

    All filters are optional and combinable. Results ordered by tier desc, rating desc.
    Always joins ClinicFeatureStore (left outer) to surface district and clinic info.
    """
    # Base: always left-join clinic so district filter and clinic fields work
    base = (
        select(Doctor, ClinicFeatureStore)
        .join(ClinicFeatureStore, Doctor.clinic_id == ClinicFeatureStore.id, isouter=True)
        .where(Doctor.is_active.is_(True))
    )
    base = _apply_doctor_filters(
        base,
        tier=tier,
        specialisation=specialisation,
        language=language,
        prakriti=prakriti,
        district=district,
        budget_max=budget_max,
        rating_min=rating_min,
    )

    # Total count (same filters, no limit/offset)
    count_stmt = (
        select(func.count(Doctor.id))
        .select_from(Doctor)
        .join(ClinicFeatureStore, Doctor.clinic_id == ClinicFeatureStore.id, isouter=True)
        .where(Doctor.is_active.is_(True))
    )
    count_stmt = _apply_doctor_filters(
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

    rows = (
        await db.execute(
            base.order_by(Doctor.tier.desc(), Doctor.rating.desc().nulls_last())
            .limit(limit)
            .offset(offset)
        )
    ).all()

    items = [
        DoctorSummary(
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
            district=c.district if c else None,
            pricing_per_day=float(d.pricing_per_day) if d.pricing_per_day is not None else None,
            photo_url=d.photo_url,
            clinic_id=str(d.clinic_id) if d.clinic_id else None,
            clinic_name=c.name if c else None,
            clinic_slug=c.slug if c else None,
        )
        for d, c in rows
    ]

    return DoctorListResponse(items=items, total=total, limit=limit, offset=offset)


# ── GET /api/doctors/{slug} ───────────────────────────────────────────────────


@router.get("/{slug}", response_model=DoctorDetail)
async def get_doctor(
    slug: str,
    lang: str = Query(default="en", pattern="^(en|ar|de|fr|ml|hi)$"),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Full doctor profile: bio, treatments, clinic, last 5 verified reviews, next available date.

    Response is cached in Redis for 60 seconds (key: `doctor:{slug}:{lang}`).
    Cache is bypassed gracefully if Redis is unavailable.
    """
    cache_key = f"doctor:{slug}:{lang}"

    cached = await cache_get(cache_key)
    if cached is not None:
        return DoctorDetail.model_validate(cached)

    # ── Fetch doctor + clinic ─────────────────────────────────────────────────
    row = (
        await db.execute(
            select(Doctor, ClinicFeatureStore)
            .join(ClinicFeatureStore, Doctor.clinic_id == ClinicFeatureStore.id, isouter=True)
            .where(Doctor.slug == slug, Doctor.is_active.is_(True))
        )
    ).one_or_none()

    if row is None:
        raise HTTPException(status_code=404, detail=f"Doctor '{slug}' not found.")

    d, c = row

    # ── Treatments (via DoctorTreatment junction) ─────────────────────────────
    treatment_rows = (
        await db.execute(
            select(Treatment)
            .join(DoctorTreatment, DoctorTreatment.treatment_id == Treatment.id)
            .where(DoctorTreatment.doctor_id == d.id, Treatment.is_active.is_(True))
            .order_by(DoctorTreatment.is_primary.desc(), Treatment.price_per_day.asc().nulls_last())
        )
    ).scalars().all()

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
        )
        for t in treatment_rows
    ]

    # ── Reviews (latest 5, verified only) ─────────────────────────────────────
    review_rows = (
        await db.execute(
            select(Review)
            .where(Review.doctor_id == d.id, Review.verified.is_(True))
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

    # ── Next available date ───────────────────────────────────────────────────
    today = date.today()
    future_dates = [av for av in (d.available_dates or []) if av >= today]
    next_available = min(future_dates) if future_dates else None

    result = DoctorDetail(
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
        district=c.district if c else None,
        pricing_per_day=float(d.pricing_per_day) if d.pricing_per_day is not None else None,
        photo_url=d.photo_url,
        patients_treated=d.patients_treated,
        bio=d.bio,
        clinic=ClinicInline(
            id=str(c.id),
            slug=c.slug,
            name=c.name,
            district=c.district,
        ) if c else None,
        treatments=treatments,
        reviews=reviews,
        next_available_date=next_available,
    )

    await cache_set(cache_key, result.model_dump(mode="json"), ttl=_CACHE_TTL)
    return result
