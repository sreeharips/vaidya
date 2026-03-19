"""
api/admin/availability.py — Clinic-level per-day availability management.

GET    /api/admin/availability           — list for a month or date range
PUT    /api/admin/availability/{date}    — upsert a single day's configuration
POST   /api/admin/availability/bulk      — set multiple days at once
DELETE /api/admin/availability/{date}    — remove configuration for a day
"""

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic
from db.database import get_db
from db.models import ClinicAvailabilitySlot, ClinicFeatureStore

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────────────────────

class DayConfig(BaseModel):
    total_slots: int = 5
    is_closed: bool = False
    close_reason: str | None = None
    treatment_ids: list[str] = []
    notes: str | None = None


class BulkDayConfig(BaseModel):
    dates: list[str]           # "YYYY-MM-DD" list
    total_slots: int = 5
    is_closed: bool = False
    close_reason: str | None = None
    treatment_ids: list[str] = []
    notes: str | None = None


class BulkRecurringConfig(BaseModel):
    """Apply config to all matching weekdays within a date range."""
    weekdays: list[int]        # 0=Mon … 6=Sun (Python weekday())
    date_from: str             # "YYYY-MM-DD"
    date_to: str               # "YYYY-MM-DD"
    total_slots: int = 5
    is_closed: bool = False
    close_reason: str | None = None
    treatment_ids: list[str] = []
    notes: str | None = None


class SlotOut(BaseModel):
    slot_date: str
    total_slots: int
    is_closed: bool
    close_reason: str | None
    treatment_ids: list[str]
    notes: str | None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_out(s: ClinicAvailabilitySlot) -> SlotOut:
    return SlotOut(
        slot_date=str(s.slot_date),
        total_slots=s.total_slots,
        is_closed=s.is_closed,
        close_reason=s.close_reason,
        treatment_ids=s.treatment_ids or [],
        notes=s.notes,
    )


async def _upsert_day(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    slot_date: date,
    config: DayConfig,
) -> ClinicAvailabilitySlot:
    existing = (await db.execute(
        select(ClinicAvailabilitySlot).where(
            ClinicAvailabilitySlot.clinic_id == clinic_id,
            ClinicAvailabilitySlot.slot_date == slot_date,
        )
    )).scalar_one_or_none()

    if existing:
        existing.total_slots = config.total_slots
        existing.is_closed = config.is_closed
        existing.close_reason = config.close_reason
        existing.treatment_ids = config.treatment_ids
        existing.notes = config.notes
        await db.flush()
        return existing
    else:
        new = ClinicAvailabilitySlot(
            clinic_id=clinic_id,
            slot_date=slot_date,
            total_slots=config.total_slots,
            is_closed=config.is_closed,
            close_reason=config.close_reason,
            treatment_ids=config.treatment_ids,
            notes=config.notes,
        )
        db.add(new)
        await db.flush()
        return new


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/availability", response_model=list[SlotOut])
async def get_availability(
    month: str | None = None,       # "2026-03"
    date_from: str | None = None,   # "2026-03-01"
    date_to: str | None = None,     # "2026-03-31"
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    """Return configured availability days for the clinic within the given range."""
    import calendar as cal

    if month:
        parts = month.split("-")
        year, mo = int(parts[0]), int(parts[1])
        _, days_in_month = cal.monthrange(year, mo)
        d_from = date(year, mo, 1)
        d_to = date(year, mo, days_in_month)
    elif date_from and date_to:
        d_from = date.fromisoformat(date_from)
        d_to = date.fromisoformat(date_to)
    else:
        raise HTTPException(status_code=400, detail="Provide 'month' or 'date_from'+'date_to'")

    rows = (await db.execute(
        select(ClinicAvailabilitySlot)
        .where(
            ClinicAvailabilitySlot.clinic_id == clinic.id,
            ClinicAvailabilitySlot.slot_date >= d_from,
            ClinicAvailabilitySlot.slot_date <= d_to,
        )
        .order_by(ClinicAvailabilitySlot.slot_date)
    )).scalars().all()

    return [_to_out(r) for r in rows]


@router.put("/availability/{slot_date}", response_model=SlotOut)
async def upsert_availability(
    slot_date: str,
    body: DayConfig,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    """Create or update availability for a specific date."""
    try:
        d = date.fromisoformat(slot_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    row = await _upsert_day(db, clinic.id, d, body)
    await db.commit()
    await db.refresh(row)
    return _to_out(row)


@router.post("/availability/bulk", response_model=list[SlotOut])
async def bulk_set_availability(
    body: BulkDayConfig,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    """Set availability for multiple explicit dates at once."""
    results = []
    for ds in body.dates:
        try:
            d = date.fromisoformat(ds)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date: {ds}")
        config = DayConfig(
            total_slots=body.total_slots,
            is_closed=body.is_closed,
            close_reason=body.close_reason,
            treatment_ids=body.treatment_ids,
            notes=body.notes,
        )
        row = await _upsert_day(db, clinic.id, d, config)
        results.append(row)

    await db.commit()
    for r in results:
        await db.refresh(r)
    return [_to_out(r) for r in results]


@router.post("/availability/recurring", response_model=dict)
async def set_recurring_availability(
    body: BulkRecurringConfig,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    """Apply config to all matching weekdays within the given date range."""
    try:
        d_from = date.fromisoformat(body.date_from)
        d_to = date.fromisoformat(body.date_to)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    if d_to < d_from:
        raise HTTPException(status_code=400, detail="date_to must be >= date_from")

    config = DayConfig(
        total_slots=body.total_slots,
        is_closed=body.is_closed,
        close_reason=body.close_reason,
        treatment_ids=body.treatment_ids,
        notes=body.notes,
    )

    count = 0
    current = d_from
    while current <= d_to:
        if current.weekday() in body.weekdays:
            await _upsert_day(db, clinic.id, current, config)
            count += 1
        current += timedelta(days=1)

    await db.commit()
    return {"updated": count, "from": str(d_from), "to": str(d_to)}


@router.delete("/availability/{slot_date}")
async def delete_availability(
    slot_date: str,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    """Remove availability configuration for a date (day reverts to clinic default)."""
    try:
        d = date.fromisoformat(slot_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    row = (await db.execute(
        select(ClinicAvailabilitySlot).where(
            ClinicAvailabilitySlot.clinic_id == clinic.id,
            ClinicAvailabilitySlot.slot_date == d,
        )
    )).scalar_one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="No configuration found for this date.")

    await db.delete(row)
    await db.commit()
    return {"deleted": slot_date}
