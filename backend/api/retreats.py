"""
api/retreats.py — Retreat endpoints (public).

GET /api/retreats — search/filter retreats
GET /api/retreats/{id} — retreat detail + availability
GET /api/retreats/{id}/availability?month=YYYY-MM — monthly availability
"""

import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select, any_
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import ClinicFeatureStore, Retreat, RetreatAvailability

router = APIRouter(prefix="/api/retreats", tags=["retreats"])


# Pydantic models

class ClinicSummaryInline(BaseModel):
    id: str
    slug: str
    name: str
    district: str | None
    tier: int
    rating: float | None
    photos: list[str]

class RetreatCard(BaseModel):
    id: str
    name: str
    package_type: str
    wellness_categories: list[str]
    duration_min_days: int
    duration_max_days: int
    price_usd: float
    includes_accommodation: bool
    includes_meals: bool
    is_active: bool
    photos: list[str]
    clinic: ClinicSummaryInline

class RetreatListResponse(BaseModel):
    items: list[RetreatCard]
    total: int
    limit: int
    offset: int

class AvailabilityDay(BaseModel):
    date: str
    available_spots: int
    is_blocked: bool

class RetreatDetail(BaseModel):
    id: str
    name: str
    name_display_en: str | None
    description_en: str | None
    package_type: str
    wellness_categories: list[str]
    duration_min_days: int
    duration_max_days: int
    price_usd: float
    price_inr: float | None
    includes_accommodation: bool
    includes_meals: bool
    includes_transfers: bool
    max_guests_per_slot: int
    what_to_expect: str | None
    contraindications: str | None
    highlights: list[str]
    treatments_included: list[str]
    ideal_for: list[str]
    prakriti_tags: list[str]
    photos: list[str]
    daily_schedule: str | None
    cancellation_policy: str | None
    language_of_instruction: list[str]
    min_age: int | None
    clinic: ClinicSummaryInline
    availability: list[AvailabilityDay]


def _clinic_inline(c: ClinicFeatureStore) -> ClinicSummaryInline:
    return ClinicSummaryInline(
        id=str(c.id), slug=c.slug, name=c.name,
        district=c.district, tier=c.tier,
        rating=float(c.rating) if c.rating is not None else None,
        photos=c.photos or [],
    )


# GET /api/retreats
@router.get("", response_model=RetreatListResponse)
async def list_retreats(
    wellness_category: str | None = Query(default=None),
    package_type: str | None = Query(default=None),
    price_min: float | None = Query(default=None, ge=0),
    price_max: float | None = Query(default=None, ge=0),
    duration_days: int | None = Query(default=None, ge=1),
    district: str | None = Query(default=None),
    includes_accommodation: bool | None = Query(default=None),
    lang: str = Query(default="en"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Retreat, ClinicFeatureStore)
        .join(ClinicFeatureStore, Retreat.clinic_id == ClinicFeatureStore.id)
        .where(Retreat.is_active.is_(True), ClinicFeatureStore.is_active.is_(True))
    )

    if wellness_category:
        stmt = stmt.where(wellness_category == any_(Retreat.wellness_categories))
    if package_type:
        stmt = stmt.where(Retreat.package_type == package_type)
    if price_min is not None:
        stmt = stmt.where(Retreat.price_usd >= price_min)
    if price_max is not None:
        stmt = stmt.where(Retreat.price_usd <= price_max)
    if duration_days is not None:
        stmt = stmt.where(Retreat.duration_min_days <= duration_days, Retreat.duration_max_days >= duration_days)
    if district:
        stmt = stmt.where(ClinicFeatureStore.district.ilike(f"%{district}%"))
    if includes_accommodation is not None:
        stmt = stmt.where(Retreat.includes_accommodation == includes_accommodation)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    rows = (await db.execute(
        stmt.order_by(ClinicFeatureStore.tier.desc(), Retreat.price_usd.asc())
        .limit(limit).offset(offset)
    )).all()

    items = [
        RetreatCard(
            id=str(r.id), name=r.name, package_type=r.package_type,
            wellness_categories=r.wellness_categories or [],
            duration_min_days=r.duration_min_days, duration_max_days=r.duration_max_days,
            price_usd=float(r.price_usd), includes_accommodation=r.includes_accommodation,
            includes_meals=r.includes_meals, is_active=r.is_active,
            photos=r.photos or [],
            clinic=_clinic_inline(c),
        )
        for r, c in rows
    ]

    return RetreatListResponse(items=items, total=total, limit=limit, offset=offset)


# GET /api/retreats/{id}
@router.get("/{retreat_id}", response_model=RetreatDetail)
async def get_retreat(
    retreat_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        rid = uuid.UUID(retreat_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid retreat ID")

    row = (await db.execute(
        select(Retreat, ClinicFeatureStore)
        .join(ClinicFeatureStore, Retreat.clinic_id == ClinicFeatureStore.id)
        .where(Retreat.id == rid, Retreat.is_active.is_(True))
    )).one_or_none()

    if row is None:
        raise HTTPException(status_code=404, detail="Retreat not found")

    r, c = row
    today = date.today()
    end = today + timedelta(days=90)

    avail_rows = (await db.execute(
        select(RetreatAvailability)
        .where(RetreatAvailability.retreat_id == rid, RetreatAvailability.date >= today, RetreatAvailability.date <= end)
        .order_by(RetreatAvailability.date)
    )).scalars().all()

    availability = [
        AvailabilityDay(date=str(a.date), available_spots=a.available_spots, is_blocked=a.is_blocked)
        for a in avail_rows
    ]

    return RetreatDetail(
        id=str(r.id), name=r.name, name_display_en=r.name_display_en,
        description_en=r.description_en, package_type=r.package_type,
        wellness_categories=r.wellness_categories or [],
        duration_min_days=r.duration_min_days, duration_max_days=r.duration_max_days,
        price_usd=float(r.price_usd), price_inr=float(r.price_inr) if r.price_inr else None,
        includes_accommodation=r.includes_accommodation, includes_meals=r.includes_meals,
        includes_transfers=r.includes_transfers, max_guests_per_slot=r.max_guests_per_slot,
        what_to_expect=r.what_to_expect, contraindications=r.contraindications,
        highlights=r.highlights or [],
        treatments_included=r.treatments_included or [],
        ideal_for=r.ideal_for or [],
        prakriti_tags=r.prakriti_tags or [],
        photos=r.photos or [],
        daily_schedule=r.daily_schedule,
        cancellation_policy=r.cancellation_policy,
        language_of_instruction=r.language_of_instruction or [],
        min_age=r.min_age,
        clinic=_clinic_inline(c), availability=availability,
    )


# GET /api/retreats/{id}/availability
@router.get("/{retreat_id}/availability", response_model=list[AvailabilityDay])
async def get_retreat_availability(
    retreat_id: str,
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
):
    try:
        rid = uuid.UUID(retreat_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid retreat ID")

    year, mon = map(int, month.split("-"))
    start = date(year, mon, 1)
    if mon == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, mon + 1, 1) - timedelta(days=1)

    rows = (await db.execute(
        select(RetreatAvailability)
        .where(RetreatAvailability.retreat_id == rid, RetreatAvailability.date >= start, RetreatAvailability.date <= end)
        .order_by(RetreatAvailability.date)
    )).scalars().all()

    return [
        AvailabilityDay(date=str(a.date), available_spots=a.available_spots, is_blocked=a.is_blocked)
        for a in rows
    ]
