"""
api/packages.py — Wellness package endpoints (public).

GET /api/packages — search/filter packages
GET /api/packages/{id} — package detail + availability
GET /api/packages/{id}/availability?month=YYYY-MM — monthly availability
"""

import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select, any_
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import ClinicFeatureStore, WellnessPackage, PackageAvailability

router = APIRouter(prefix="/api/packages", tags=["packages"])


# Pydantic models

class ClinicSummaryInline(BaseModel):
    id: str
    slug: str
    name: str
    district: str | None
    tier: int
    rating: float | None
    photos: list[str]

class PackageCard(BaseModel):
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
    clinic: ClinicSummaryInline

class PackageListResponse(BaseModel):
    items: list[PackageCard]
    total: int

class AvailabilityDay(BaseModel):
    date: str
    available_spots: int
    is_blocked: bool

class PackageDetail(BaseModel):
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
    clinic: ClinicSummaryInline
    availability: list[AvailabilityDay]


def _clinic_inline(c: ClinicFeatureStore) -> ClinicSummaryInline:
    return ClinicSummaryInline(
        id=str(c.id), slug=c.slug, name=c.name,
        district=c.district, tier=c.tier,
        rating=float(c.rating) if c.rating is not None else None,
        photos=c.photos or [],
    )


# GET /api/packages
@router.get("", response_model=PackageListResponse)
async def list_packages(
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
        select(WellnessPackage, ClinicFeatureStore)
        .join(ClinicFeatureStore, WellnessPackage.clinic_id == ClinicFeatureStore.id)
        .where(WellnessPackage.is_active.is_(True), ClinicFeatureStore.is_active.is_(True))
    )

    if wellness_category:
        stmt = stmt.where(wellness_category == any_(WellnessPackage.wellness_categories))
    if package_type:
        stmt = stmt.where(WellnessPackage.package_type == package_type)
    if price_min is not None:
        stmt = stmt.where(WellnessPackage.price_usd >= price_min)
    if price_max is not None:
        stmt = stmt.where(WellnessPackage.price_usd <= price_max)
    if duration_days is not None:
        stmt = stmt.where(WellnessPackage.duration_min_days <= duration_days, WellnessPackage.duration_max_days >= duration_days)
    if district:
        stmt = stmt.where(ClinicFeatureStore.district.ilike(f"%{district}%"))
    if includes_accommodation is not None:
        stmt = stmt.where(WellnessPackage.includes_accommodation == includes_accommodation)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    rows = (await db.execute(
        stmt.order_by(ClinicFeatureStore.tier.desc(), WellnessPackage.price_usd.asc())
        .limit(limit).offset(offset)
    )).all()

    items = [
        PackageCard(
            id=str(p.id), name=p.name, package_type=p.package_type,
            wellness_categories=p.wellness_categories or [],
            duration_min_days=p.duration_min_days, duration_max_days=p.duration_max_days,
            price_usd=float(p.price_usd), includes_accommodation=p.includes_accommodation,
            includes_meals=p.includes_meals, is_active=p.is_active,
            clinic=_clinic_inline(c),
        )
        for p, c in rows
    ]

    return PackageListResponse(items=items, total=total)


# GET /api/packages/{id}
@router.get("/{package_id}", response_model=PackageDetail)
async def get_package(
    package_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        pid = uuid.UUID(package_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid package ID")

    row = (await db.execute(
        select(WellnessPackage, ClinicFeatureStore)
        .join(ClinicFeatureStore, WellnessPackage.clinic_id == ClinicFeatureStore.id)
        .where(WellnessPackage.id == pid, WellnessPackage.is_active.is_(True))
    )).one_or_none()

    if row is None:
        raise HTTPException(status_code=404, detail="Package not found")

    p, c = row
    today = date.today()
    end = today + timedelta(days=90)

    avail_rows = (await db.execute(
        select(PackageAvailability)
        .where(PackageAvailability.package_id == pid, PackageAvailability.date >= today, PackageAvailability.date <= end)
        .order_by(PackageAvailability.date)
    )).scalars().all()

    availability = [
        AvailabilityDay(date=str(a.date), available_spots=a.available_spots, is_blocked=a.is_blocked)
        for a in avail_rows
    ]

    return PackageDetail(
        id=str(p.id), name=p.name, name_display_en=p.name_display_en,
        description_en=p.description_en, package_type=p.package_type,
        wellness_categories=p.wellness_categories or [],
        duration_min_days=p.duration_min_days, duration_max_days=p.duration_max_days,
        price_usd=float(p.price_usd), price_inr=float(p.price_inr) if p.price_inr else None,
        includes_accommodation=p.includes_accommodation, includes_meals=p.includes_meals,
        includes_transfers=p.includes_transfers, max_guests_per_slot=p.max_guests_per_slot,
        what_to_expect=p.what_to_expect, contraindications=p.contraindications,
        clinic=_clinic_inline(c), availability=availability,
    )


# GET /api/packages/{id}/availability
@router.get("/{package_id}/availability", response_model=list[AvailabilityDay])
async def get_package_availability(
    package_id: str,
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
):
    try:
        pid = uuid.UUID(package_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid package ID")

    year, mon = map(int, month.split("-"))
    start = date(year, mon, 1)
    if mon == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, mon + 1, 1) - timedelta(days=1)

    rows = (await db.execute(
        select(PackageAvailability)
        .where(PackageAvailability.package_id == pid, PackageAvailability.date >= start, PackageAvailability.date <= end)
        .order_by(PackageAvailability.date)
    )).scalars().all()

    return [
        AvailabilityDay(date=str(a.date), available_spots=a.available_spots, is_blocked=a.is_blocked)
        for a in rows
    ]
