"""
api/admin/bookings.py — Booking management for clinic admins.

GET    /api/admin/bookings
PATCH  /api/admin/bookings/{id}/confirm
PATCH  /api/admin/bookings/{id}/decline
PATCH  /api/admin/bookings/{id}/complete
GET    /api/admin/bookings/stats
"""

import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic
from db.database import get_db
from db.models import Booking, ClinicFeatureStore, Doctor, Treatment
from db.outcomes import append_outcome

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────────────────────

class BookingListItem(BaseModel):
    id: str
    patient_display: str
    treatment_name: str
    doctor_name: str | None
    start_date: str
    end_date: str
    status: str
    total_amount: float | None
    currency: str
    created_at: str


class BookingsPage(BaseModel):
    items: list[BookingListItem]
    total: int


class DeclineBody(BaseModel):
    reason: str


class BookingStats(BaseModel):
    total_this_month: int
    revenue_this_month: float
    pending_count: int
    avg_stay_days: float
    top_treatment: str | None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/bookings", response_model=BookingsPage)
async def list_bookings(
    status: str | None = None,
    limit: int = 20,
    offset: int = 0,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    q = select(Booking).where(Booking.clinic_id == clinic.id)
    if status:
        q = q.where(Booking.status == status)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    results = (await db.execute(
        q.order_by(Booking.created_at.desc()).offset(offset).limit(limit)
    )).scalars().all()

    items = []
    for b in results:
        treatment = await db.get(Treatment, b.treatment_id) if b.treatment_id else None
        doctor = await db.get(Doctor, b.doctor_id) if b.doctor_id else None
        items.append(BookingListItem(
            id=str(b.id),
            patient_display=b.guest_email or f"Guest #{str(b.patient_pseudo_id)[:8]}",
            treatment_name=treatment.name if treatment else "—",
            doctor_name=doctor.name if doctor else None,
            start_date=str(b.start_date),
            end_date=str(b.end_date),
            status=b.status,
            total_amount=float(b.total_amount) if b.total_amount else None,
            currency=b.currency,
            created_at=b.created_at.isoformat(),
        ))

    return BookingsPage(items=items, total=total)


@router.patch("/bookings/{booking_id}/confirm")
async def confirm_booking(
    booking_id: str,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    booking = await db.get(Booking, uuid.UUID(booking_id))
    if not booking or booking.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status not in ("pending", "payment_received"):
        raise HTTPException(status_code=400, detail=f"Cannot confirm booking with status '{booking.status}'")

    booking.status = "confirmed"
    booking.updated_at = datetime.now(timezone.utc)

    await append_outcome(
        db,
        event_type="booking_confirmed",
        patient_pseudo_id=booking.patient_pseudo_id,
        clinic_id=booking.clinic_id,
        doctor_id=booking.doctor_id,
        booking_status="confirmed",
    )

    return {"id": booking_id, "status": "confirmed"}


@router.patch("/bookings/{booking_id}/decline")
async def decline_booking(
    booking_id: str,
    body: DeclineBody,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    booking = await db.get(Booking, uuid.UUID(booking_id))
    if not booking or booking.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status not in ("pending", "payment_received", "confirmed"):
        raise HTTPException(status_code=400, detail=f"Cannot decline booking with status '{booking.status}'")

    booking.status = "cancelled"
    booking.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # TODO: trigger refund if payment was received
    # TODO: send notification to patient with reason

    return {"id": booking_id, "status": "cancelled", "reason": body.reason}


@router.patch("/bookings/{booking_id}/complete")
async def complete_booking(
    booking_id: str,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    booking = await db.get(Booking, uuid.UUID(booking_id))
    if not booking or booking.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "confirmed":
        raise HTTPException(status_code=400, detail=f"Cannot complete booking with status '{booking.status}'")

    booking.status = "completed"
    booking.updated_at = datetime.now(timezone.utc)

    await append_outcome(
        db,
        event_type="booking_completed",
        patient_pseudo_id=booking.patient_pseudo_id,
        clinic_id=booking.clinic_id,
        doctor_id=booking.doctor_id,
        booking_status="completed",
    )

    return {
        "id": booking_id,
        "status": "completed",
        "prompt": "Would you like to record a consultation for this booking?",
    }


@router.get("/bookings/stats", response_model=BookingStats)
async def get_booking_stats(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    month_start = today.replace(day=1)

    # This month's bookings
    month_q = select(Booking).where(
        Booking.clinic_id == clinic.id,
        Booking.created_at >= datetime(month_start.year, month_start.month, month_start.day, tzinfo=timezone.utc),
    )
    month_bookings = (await db.execute(month_q)).scalars().all()

    total_this_month = len(month_bookings)
    revenue = sum(float(b.total_amount or 0) for b in month_bookings if b.status in ("confirmed", "completed", "payment_received"))

    # Pending
    pending_count = sum(1 for b in month_bookings if b.status == "pending")

    # Average stay
    stays = [(b.end_date - b.start_date).days for b in month_bookings if b.start_date and b.end_date]
    avg_stay = sum(stays) / len(stays) if stays else 0

    # Top treatment
    treatment_counts: dict[str, int] = {}
    for b in month_bookings:
        if b.treatment_id:
            t = await db.get(Treatment, b.treatment_id)
            if t:
                treatment_counts[t.name] = treatment_counts.get(t.name, 0) + 1

    top = max(treatment_counts, key=treatment_counts.get) if treatment_counts else None

    return BookingStats(
        total_this_month=total_this_month,
        revenue_this_month=round(revenue, 2),
        pending_count=pending_count,
        avg_stay_days=round(avg_stay, 1),
        top_treatment=top,
    )
