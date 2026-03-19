"""
api/clinics.py — Clinic list and profile endpoints.

GET /api/clinics?tier=&specialisation=&language=&prakriti=&district=&budget_max=&rating_min=&limit=20&offset=0
GET /api/clinics/{slug}
"""

from collections import defaultdict
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import any_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.cache import cache_get, cache_set
from db.database import get_db
from db.models import Booking, ClinicAvailabilitySlot, ClinicFeatureStore, Doctor, DoctorTreatment, Product, ProductVariant, Review, Treatment

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
    # Names of doctors who deliver this treatment (via DoctorTreatment junction)
    doctors: list[str]


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


class ProductVariantOut(BaseModel):
    id: str
    label: str
    sku: str | None
    price: float
    stock_qty: int


class ProductOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str | None
    category: str | None
    prakriti_tags: list[str]
    base_price: float | None
    currency: str
    photos: list[str]
    is_gmp_certified: bool
    variants: list[ProductVariantOut]


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
    description: str | None
    phone: str | None
    email: str | None
    website_url: str | None
    lat: float | None
    lng: float | None
    doctors: list[DoctorAtClinic]
    treatments: list[TreatmentInline]
    products: list[ProductOut]
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
    """Full clinic profile: all fields, doctor roster, treatments with delivering doctors,
    herbal products with variants, and last 5 verified reviews.

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
    # Treatments are clinic-owned (clinic_id NOT NULL).
    # Which doctors deliver each treatment is stored in doctor_treatments junction.
    treatment_rows = (
        await db.execute(
            select(Treatment)
            .where(Treatment.clinic_id == clinic.id, Treatment.is_active.is_(True))
            .order_by(Treatment.price_per_day.asc().nulls_last())
        )
    ).scalars().all()

    # Build a map of treatment_id → [doctor names] from the junction table
    treatment_ids = [t.id for t in treatment_rows]
    treatment_doctors: dict[str, list[str]] = defaultdict(list)
    if treatment_ids:
        junction_rows = (
            await db.execute(
                select(DoctorTreatment, Doctor)
                .join(Doctor, DoctorTreatment.doctor_id == Doctor.id)
                .where(DoctorTreatment.treatment_id.in_(treatment_ids))
                .order_by(DoctorTreatment.is_primary.desc())
            )
        ).all()
        for dt, doc in junction_rows:
            treatment_doctors[str(dt.treatment_id)].append(doc.name)

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
            doctors=treatment_doctors.get(str(t.id), []),
        )
        for t in treatment_rows
    ]

    # ── Products (herbal shop) ────────────────────────────────────────────────
    product_rows = (
        await db.execute(
            select(Product)
            .where(Product.clinic_id == clinic.id, Product.is_active.is_(True))
            .order_by(Product.category.asc().nulls_last(), Product.name.asc())
        )
    ).scalars().all()

    # Fetch all variants for these products in one query
    product_ids = [p.id for p in product_rows]
    variants_by_product: dict[str, list[ProductVariantOut]] = defaultdict(list)
    if product_ids:
        variant_rows = (
            await db.execute(
                select(ProductVariant)
                .where(ProductVariant.product_id.in_(product_ids), ProductVariant.is_active.is_(True))
                .order_by(ProductVariant.price.asc())
            )
        ).scalars().all()
        for v in variant_rows:
            variants_by_product[str(v.product_id)].append(
                ProductVariantOut(
                    id=str(v.id),
                    label=v.label,
                    sku=v.sku,
                    price=float(v.price),
                    stock_qty=v.stock_qty,
                )
            )

    products = [
        ProductOut(
            id=str(p.id),
            slug=p.slug,
            name=p.name,
            description=p.description,
            category=p.category,
            prakriti_tags=p.prakriti_tags or [],
            base_price=float(p.base_price) if p.base_price is not None else None,
            currency=p.currency,
            photos=p.photos or [],
            is_gmp_certified=p.is_gmp_certified,
            variants=variants_by_product.get(str(p.id), []),
        )
        for p in product_rows
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

    # Get language-specific description
    description = None
    if lang == "ml":
        description = clinic.description_ml
    else:
        description = clinic.description_en

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
        description=description,
        phone=clinic.phone,
        email=clinic.email,
        website_url=clinic.website_url,
        lat=clinic.lat,
        lng=clinic.lng,
        doctors=doctors,
        treatments=treatments,
        products=products,
        reviews=reviews,
    )

    await cache_set(cache_key, result.model_dump(mode="json"), ttl=_CACHE_TTL)
    return result


# ── GET /api/clinics/{slug}/availability ─────────────────────────────────────


@router.get("/{slug}/availability")
async def get_clinic_availability(
    slug: str,
    days: int = Query(default=30, ge=7, le=90),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """
    Public availability endpoint — used by the patient-facing booking flow.
    Returns slot availability for the next `days` days (default 30).
    Does NOT expose admin-only fields (notes, booked_count breakdown).
    """
    import calendar as _cal
    from datetime import date as _date, timedelta

    clinic = (
        await db.execute(
            select(ClinicFeatureStore)
            .where(ClinicFeatureStore.slug == slug, ClinicFeatureStore.is_active.is_(True))
        )
    ).scalar_one_or_none()
    if clinic is None:
        raise HTTPException(status_code=404, detail=f"Clinic '{slug}' not found.")

    today = _date.today()
    end_date = today + timedelta(days=days)

    # Fetch slot configs
    slot_rows = (await db.execute(
        select(ClinicAvailabilitySlot).where(
            ClinicAvailabilitySlot.clinic_id == clinic.id,
            ClinicAvailabilitySlot.slot_date >= today,
            ClinicAvailabilitySlot.slot_date <= end_date,
        )
    )).scalars().all()

    # Booked counts per day
    booked_rows = (await db.execute(
        select(Booking.start_date, func.count(Booking.id)).where(
            Booking.clinic_id == clinic.id,
            Booking.start_date >= today,
            Booking.start_date <= end_date,
            Booking.status.in_(["pending", "confirmed"]),
        ).group_by(Booking.start_date)
    )).all()
    booked_by_date: dict = {r[0]: r[1] for r in booked_rows}

    # Treatment names lookup
    t_rows = (await db.execute(
        select(Treatment).where(Treatment.clinic_id == clinic.id, Treatment.is_active.is_(True))
    )).scalars().all()
    treatment_names = {str(t.id): t.name for t in t_rows}

    slots = []
    for s in slot_rows:
        booked = booked_by_date.get(s.slot_date, 0)
        avail = max(0, s.total_slots - booked)
        slots.append({
            "date": str(s.slot_date),
            "available_slots": avail,
            "total_slots": s.total_slots,
            "is_closed": s.is_closed,
            "treatment_names": [treatment_names.get(tid, "") for tid in (s.treatment_ids or [])],
        })

    return {
        "clinic_id": str(clinic.id),
        "clinic_name": clinic.name,
        "days_ahead": days,
        "slots": sorted(slots, key=lambda x: x["date"]),
    }
