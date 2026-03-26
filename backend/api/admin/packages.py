"""
api/admin/packages.py — Package management for clinic admins.
"""

import re
import uuid
from datetime import date, timedelta, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic
from db.database import get_db
from db.models import Booking, ClinicFeatureStore, WellnessPackage, PackageAvailability

router = APIRouter()


class PackageOut(BaseModel):
    id: str
    name: str
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
    is_active: bool
    display_order: int

class PackageCreate(BaseModel):
    name: str
    name_display_en: str | None = None
    name_display_ar: str | None = None
    name_display_ml: str | None = None
    description_en: str | None = None
    description_ar: str | None = None
    description_ml: str | None = None
    package_type: str = "retreat"
    wellness_categories: list[str] = []
    duration_min_days: int = 7
    duration_max_days: int = 14
    price_usd: float
    price_inr: float | None = None
    includes_accommodation: bool = False
    includes_meals: bool = False
    includes_transfers: bool = False
    max_guests_per_slot: int = 1
    what_to_expect: str | None = None
    contraindications: str | None = None
    is_active: bool = True
    display_order: int = 0

class PackageUpdate(BaseModel):
    name: str | None = None
    name_display_en: str | None = None
    name_display_ar: str | None = None
    name_display_ml: str | None = None
    description_en: str | None = None
    description_ar: str | None = None
    description_ml: str | None = None
    package_type: str | None = None
    wellness_categories: list[str] | None = None
    duration_min_days: int | None = None
    duration_max_days: int | None = None
    price_usd: float | None = None
    price_inr: float | None = None
    includes_accommodation: bool | None = None
    includes_meals: bool | None = None
    includes_transfers: bool | None = None
    max_guests_per_slot: int | None = None
    what_to_expect: str | None = None
    contraindications: str | None = None
    is_active: bool | None = None
    display_order: int | None = None

class SetAvailabilityBody(BaseModel):
    date: date
    available_spots: int = 1

class BlockDatesBody(BaseModel):
    date_from: date
    date_to: date
    reason: str | None = None

class AvailabilityOut(BaseModel):
    date: str
    available_spots: int
    is_blocked: bool
    block_reason: str | None


def _package_out(p: WellnessPackage) -> PackageOut:
    return PackageOut(
        id=str(p.id), name=p.name, package_type=p.package_type,
        wellness_categories=p.wellness_categories or [],
        duration_min_days=p.duration_min_days, duration_max_days=p.duration_max_days,
        price_usd=float(p.price_usd), price_inr=float(p.price_inr) if p.price_inr else None,
        includes_accommodation=p.includes_accommodation, includes_meals=p.includes_meals,
        includes_transfers=p.includes_transfers, max_guests_per_slot=p.max_guests_per_slot,
        is_active=p.is_active, display_order=p.display_order,
    )


@router.get("/packages", response_model=list[PackageOut])
async def list_packages(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WellnessPackage).where(WellnessPackage.clinic_id == clinic.id)
        .order_by(WellnessPackage.display_order, WellnessPackage.name)
    )
    return [_package_out(p) for p in result.scalars().all()]


@router.post("/packages", response_model=PackageOut, status_code=201)
async def create_package(
    body: PackageCreate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    pkg = WellnessPackage(
        clinic_id=clinic.id,
        name=body.name,
        name_display_en=body.name_display_en,
        name_display_ar=body.name_display_ar,
        name_display_ml=body.name_display_ml,
        description_en=body.description_en,
        description_ar=body.description_ar,
        description_ml=body.description_ml,
        package_type=body.package_type,
        wellness_categories=body.wellness_categories,
        duration_min_days=body.duration_min_days,
        duration_max_days=body.duration_max_days,
        price_usd=body.price_usd,
        price_inr=body.price_inr,
        includes_accommodation=body.includes_accommodation,
        includes_meals=body.includes_meals,
        includes_transfers=body.includes_transfers,
        max_guests_per_slot=body.max_guests_per_slot,
        what_to_expect=body.what_to_expect,
        contraindications=body.contraindications,
        is_active=body.is_active,
        display_order=body.display_order,
    )
    db.add(pkg)
    await db.commit()
    await db.refresh(pkg)
    return _package_out(pkg)


@router.patch("/packages/{package_id}", response_model=PackageOut)
async def update_package(
    package_id: str,
    body: PackageUpdate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    pkg = await db.get(WellnessPackage, uuid.UUID(package_id))
    if not pkg or pkg.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Package not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(pkg, field, value)

    await db.commit()
    await db.refresh(pkg)
    return _package_out(pkg)


@router.delete("/packages/{package_id}")
async def delete_package(
    package_id: str,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    pkg = await db.get(WellnessPackage, uuid.UUID(package_id))
    if not pkg or pkg.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Package not found")

    pkg.is_active = False
    await db.commit()
    return {"id": package_id, "is_active": False}


@router.post("/packages/{package_id}/set-availability")
async def set_availability(
    package_id: str,
    body: SetAvailabilityBody,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    pkg = await db.get(WellnessPackage, uuid.UUID(package_id))
    if not pkg or pkg.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Package not found")

    existing = (await db.execute(
        select(PackageAvailability).where(
            PackageAvailability.package_id == pkg.id,
            PackageAvailability.date == body.date,
        )
    )).scalar_one_or_none()

    if existing:
        existing.available_spots = body.available_spots
        existing.is_blocked = False
        existing.block_reason = None
    else:
        db.add(PackageAvailability(
            package_id=pkg.id, date=body.date,
            available_spots=body.available_spots,
        ))

    await db.commit()
    return {"date": str(body.date), "available_spots": body.available_spots}


@router.post("/packages/{package_id}/block-dates")
async def block_dates(
    package_id: str,
    body: BlockDatesBody,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    pkg = await db.get(WellnessPackage, uuid.UUID(package_id))
    if not pkg or pkg.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Package not found")

    current = body.date_from
    blocked_count = 0
    while current <= body.date_to:
        existing = (await db.execute(
            select(PackageAvailability).where(
                PackageAvailability.package_id == pkg.id,
                PackageAvailability.date == current,
            )
        )).scalar_one_or_none()

        if existing:
            existing.is_blocked = True
            existing.block_reason = body.reason
            existing.available_spots = 0
        else:
            db.add(PackageAvailability(
                package_id=pkg.id, date=current,
                available_spots=0, is_blocked=True, block_reason=body.reason,
            ))
        blocked_count += 1
        current += timedelta(days=1)

    await db.commit()
    return {"blocked_dates": blocked_count, "from": str(body.date_from), "to": str(body.date_to)}


@router.get("/packages/{package_id}/calendar", response_model=list[AvailabilityOut])
async def get_calendar(
    package_id: str,
    month: str = None,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    pkg = await db.get(WellnessPackage, uuid.UUID(package_id))
    if not pkg or pkg.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Package not found")

    if month:
        year, mon = map(int, month.split("-"))
        start = date(year, mon, 1)
        end = date(year, mon + 1, 1) - timedelta(days=1) if mon < 12 else date(year + 1, 1, 1) - timedelta(days=1)
    else:
        start = date.today()
        end = start + timedelta(days=30)

    rows = (await db.execute(
        select(PackageAvailability).where(
            PackageAvailability.package_id == pkg.id,
            PackageAvailability.date >= start,
            PackageAvailability.date <= end,
        ).order_by(PackageAvailability.date)
    )).scalars().all()

    return [
        AvailabilityOut(date=str(a.date), available_spots=a.available_spots,
                        is_blocked=a.is_blocked, block_reason=a.block_reason)
        for a in rows
    ]
