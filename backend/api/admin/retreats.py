"""
api/admin/retreats.py — Retreat management for clinic admins.
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
from db.models import Booking, ClinicFeatureStore, Retreat, RetreatAvailability

router = APIRouter()


class RetreatOut(BaseModel):
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
    is_active: bool
    display_order: int

class RetreatCreate(BaseModel):
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
    highlights: list[str] = []
    treatments_included: list[str] = []
    ideal_for: list[str] = []
    prakriti_tags: list[str] = []
    photos: list[str] = []
    daily_schedule: str | None = None
    cancellation_policy: str | None = None
    language_of_instruction: list[str] = []
    min_age: int | None = None
    is_active: bool = True
    display_order: int = 0

class RetreatUpdate(BaseModel):
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
    highlights: list[str] | None = None
    treatments_included: list[str] | None = None
    ideal_for: list[str] | None = None
    prakriti_tags: list[str] | None = None
    photos: list[str] | None = None
    daily_schedule: str | None = None
    cancellation_policy: str | None = None
    language_of_instruction: list[str] | None = None
    min_age: int | None = None
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


def _retreat_out(r: Retreat) -> RetreatOut:
    return RetreatOut(
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
        is_active=r.is_active, display_order=r.display_order,
    )


@router.get("/retreats", response_model=list[RetreatOut])
async def list_retreats(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Retreat).where(Retreat.clinic_id == clinic.id)
        .order_by(Retreat.display_order, Retreat.name)
    )
    return [_retreat_out(r) for r in result.scalars().all()]


@router.post("/retreats", response_model=RetreatOut, status_code=201)
async def create_retreat(
    body: RetreatCreate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    retreat = Retreat(
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
        highlights=body.highlights,
        treatments_included=body.treatments_included,
        ideal_for=body.ideal_for,
        prakriti_tags=body.prakriti_tags,
        photos=body.photos,
        daily_schedule=body.daily_schedule,
        cancellation_policy=body.cancellation_policy,
        language_of_instruction=body.language_of_instruction,
        min_age=body.min_age,
        is_active=body.is_active,
        display_order=body.display_order,
    )
    db.add(retreat)
    await db.commit()
    await db.refresh(retreat)
    return _retreat_out(retreat)


@router.patch("/retreats/{retreat_id}", response_model=RetreatOut)
async def update_retreat(
    retreat_id: str,
    body: RetreatUpdate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    retreat = await db.get(Retreat, uuid.UUID(retreat_id))
    if not retreat or retreat.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Retreat not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(retreat, field, value)

    await db.commit()
    await db.refresh(retreat)
    return _retreat_out(retreat)


@router.delete("/retreats/{retreat_id}")
async def delete_retreat(
    retreat_id: str,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    retreat = await db.get(Retreat, uuid.UUID(retreat_id))
    if not retreat or retreat.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Retreat not found")

    retreat.is_active = False
    await db.commit()
    return {"id": retreat_id, "is_active": False}


@router.post("/retreats/{retreat_id}/set-availability")
async def set_availability(
    retreat_id: str,
    body: SetAvailabilityBody,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    retreat = await db.get(Retreat, uuid.UUID(retreat_id))
    if not retreat or retreat.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Retreat not found")

    existing = (await db.execute(
        select(RetreatAvailability).where(
            RetreatAvailability.retreat_id == retreat.id,
            RetreatAvailability.date == body.date,
        )
    )).scalar_one_or_none()

    if existing:
        existing.available_spots = body.available_spots
        existing.is_blocked = False
        existing.block_reason = None
    else:
        db.add(RetreatAvailability(
            retreat_id=retreat.id, date=body.date,
            available_spots=body.available_spots,
        ))

    await db.commit()
    return {"date": str(body.date), "available_spots": body.available_spots}


@router.post("/retreats/{retreat_id}/block-dates")
async def block_dates(
    retreat_id: str,
    body: BlockDatesBody,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    retreat = await db.get(Retreat, uuid.UUID(retreat_id))
    if not retreat or retreat.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Retreat not found")

    current = body.date_from
    blocked_count = 0
    while current <= body.date_to:
        existing = (await db.execute(
            select(RetreatAvailability).where(
                RetreatAvailability.retreat_id == retreat.id,
                RetreatAvailability.date == current,
            )
        )).scalar_one_or_none()

        if existing:
            existing.is_blocked = True
            existing.block_reason = body.reason
            existing.available_spots = 0
        else:
            db.add(RetreatAvailability(
                retreat_id=retreat.id, date=current,
                available_spots=0, is_blocked=True, block_reason=body.reason,
            ))
        blocked_count += 1
        current += timedelta(days=1)

    await db.commit()
    return {"blocked_dates": blocked_count, "from": str(body.date_from), "to": str(body.date_to)}


@router.get("/retreats/{retreat_id}/calendar", response_model=list[AvailabilityOut])
async def get_calendar(
    retreat_id: str,
    month: str = None,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    retreat = await db.get(Retreat, uuid.UUID(retreat_id))
    if not retreat or retreat.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Retreat not found")

    if month:
        year, mon = map(int, month.split("-"))
        start = date(year, mon, 1)
        end = date(year, mon + 1, 1) - timedelta(days=1) if mon < 12 else date(year + 1, 1, 1) - timedelta(days=1)
    else:
        start = date.today()
        end = start + timedelta(days=30)

    rows = (await db.execute(
        select(RetreatAvailability).where(
            RetreatAvailability.retreat_id == retreat.id,
            RetreatAvailability.date >= start,
            RetreatAvailability.date <= end,
        ).order_by(RetreatAvailability.date)
    )).scalars().all()

    return [
        AvailabilityOut(date=str(a.date), available_spots=a.available_spots,
                        is_blocked=a.is_blocked, block_reason=a.block_reason)
        for a in rows
    ]
