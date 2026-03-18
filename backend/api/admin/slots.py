"""
api/admin/slots.py — Booking slot management.

POST   /api/admin/slots/recurring
POST   /api/admin/slots/single
POST   /api/admin/slots/block
GET    /api/admin/slots/calendar
DELETE /api/admin/slots/{id}
"""

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic
from db.database import get_db
from db.models import BookingSlot, ClinicFeatureStore

router = APIRouter()

_DAY_MAP = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}


# ── Pydantic models ──────────────────────────────────────────────────────────

class RecurringSlotCreate(BaseModel):
    doctor_id: str | None = None
    treatment_id: str | None = None
    pattern: str = "weekly"
    days: list[str]  # ["mon", "wed", "fri"]
    start_time: str  # "09:00"
    end_time: str  # "18:00"
    max_bookings: int = 1
    valid_from: date | None = None
    valid_until: date | None = None


class SingleSlotCreate(BaseModel):
    doctor_id: str | None = None
    treatment_id: str | None = None
    date: date
    start_time: str
    end_time: str
    max_bookings: int = 1
    notes: str | None = None


class BlockCreate(BaseModel):
    doctor_id: str | None = None
    date_from: date
    date_to: date
    reason: str | None = None


class SlotOut(BaseModel):
    id: str
    slot_type: str
    date: str | None
    start_time: str
    end_time: str
    max_bookings: int
    current_bookings: int
    is_active: bool
    doctor_id: str | None
    treatment_id: str | None
    notes: str | None
    recurrence: dict | None


class CalendarDay(BaseModel):
    date: str
    slots: list[SlotOut]
    available_count: int
    booked_count: int
    blocked: bool


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/slots/recurring", status_code=201)
async def create_recurring_slots(
    body: RecurringSlotCreate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    """Create recurring slot pattern — generates individual slots for 90 days."""
    start = body.valid_from or date.today()
    end = body.valid_until or (start + timedelta(days=90))

    recurrence = {
        "pattern": body.pattern,
        "days": body.days,
        "time": body.start_time,
        "duration_hours": 8,
    }

    target_weekdays = [_DAY_MAP[d.lower()] for d in body.days if d.lower() in _DAY_MAP]
    created = 0
    current = start

    while current <= end:
        if current.weekday() in target_weekdays:
            slot = BookingSlot(
                clinic_id=clinic.id,
                doctor_id=uuid.UUID(body.doctor_id) if body.doctor_id else None,
                treatment_id=uuid.UUID(body.treatment_id) if body.treatment_id else None,
                slot_type="recurring",
                recurrence=recurrence,
                date=current,
                start_time=body.start_time,
                end_time=body.end_time,
                max_bookings=body.max_bookings,
            )
            db.add(slot)
            created += 1
        current += timedelta(days=1)

    await db.commit()
    return {"created": created, "from": str(start), "to": str(end)}


@router.post("/slots/single", response_model=SlotOut, status_code=201)
async def create_single_slot(
    body: SingleSlotCreate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    slot = BookingSlot(
        clinic_id=clinic.id,
        doctor_id=uuid.UUID(body.doctor_id) if body.doctor_id else None,
        treatment_id=uuid.UUID(body.treatment_id) if body.treatment_id else None,
        slot_type="single",
        date=body.date,
        start_time=body.start_time,
        end_time=body.end_time,
        max_bookings=body.max_bookings,
        notes=body.notes,
    )
    db.add(slot)
    await db.commit()
    await db.refresh(slot)
    return _slot_to_out(slot)


@router.post("/slots/block", status_code=201)
async def block_dates(
    body: BlockCreate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    """Block out date range (holidays, doctor leave)."""
    if body.date_to < body.date_from:
        raise HTTPException(status_code=400, detail="date_to must be >= date_from")

    created = 0
    current = body.date_from
    while current <= body.date_to:
        slot = BookingSlot(
            clinic_id=clinic.id,
            doctor_id=uuid.UUID(body.doctor_id) if body.doctor_id else None,
            slot_type="blocked",
            date=current,
            start_time="00:00",
            end_time="23:59",
            max_bookings=0,
            notes=body.reason,
        )
        db.add(slot)
        created += 1
        current += timedelta(days=1)

    await db.commit()
    return {"blocked": created, "from": str(body.date_from), "to": str(body.date_to)}


@router.get("/slots/calendar", response_model=list[CalendarDay])
async def get_calendar(
    month: str,  # "2026-04"
    doctor_id: str | None = None,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    import calendar as cal

    parts = month.split("-")
    year, mo = int(parts[0]), int(parts[1])
    _, days_in_month = cal.monthrange(year, mo)
    month_start = date(year, mo, 1)
    month_end = date(year, mo, days_in_month)

    q = select(BookingSlot).where(
        BookingSlot.clinic_id == clinic.id,
        BookingSlot.date >= month_start,
        BookingSlot.date <= month_end,
        BookingSlot.is_active.is_(True),
    )
    if doctor_id:
        q = q.where(BookingSlot.doctor_id == uuid.UUID(doctor_id))

    slots = (await db.execute(q.order_by(BookingSlot.date, BookingSlot.start_time))).scalars().all()

    # Group by date
    by_date: dict[date, list[BookingSlot]] = {}
    for s in slots:
        by_date.setdefault(s.date, []).append(s)

    result = []
    current = month_start
    while current <= month_end:
        day_slots = by_date.get(current, [])
        blocked = any(s.slot_type == "blocked" for s in day_slots)
        available = sum(max(0, s.max_bookings - s.current_bookings) for s in day_slots if s.slot_type != "blocked")
        booked = sum(s.current_bookings for s in day_slots if s.slot_type != "blocked")

        result.append(CalendarDay(
            date=str(current),
            slots=[_slot_to_out(s) for s in day_slots],
            available_count=available,
            booked_count=booked,
            blocked=blocked,
        ))
        current += timedelta(days=1)

    return result


@router.delete("/slots/{slot_id}")
async def delete_slot(
    slot_id: str,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    slot = await db.get(BookingSlot, uuid.UUID(slot_id))
    if not slot or slot.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Slot not found")

    if slot.current_bookings > 0:
        # Log notification task instead of hard-deleting
        slot.is_active = False
        await db.commit()
        return {"id": slot_id, "deactivated": True, "note": "Slot had bookings — deactivated instead of deleted"}

    await db.delete(slot)
    await db.commit()
    return {"deleted": slot_id}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _slot_to_out(s: BookingSlot) -> SlotOut:
    return SlotOut(
        id=str(s.id),
        slot_type=s.slot_type,
        date=str(s.date) if s.date else None,
        start_time=s.start_time,
        end_time=s.end_time,
        max_bookings=s.max_bookings,
        current_bookings=s.current_bookings,
        is_active=s.is_active,
        doctor_id=str(s.doctor_id) if s.doctor_id else None,
        treatment_id=str(s.treatment_id) if s.treatment_id else None,
        notes=s.notes,
        recurrence=s.recurrence,
    )
