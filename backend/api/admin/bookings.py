"""
api/admin/bookings.py — Booking management for clinic admins.

GET    /api/admin/bookings              — list bookings (filterable by status)
POST   /api/admin/bookings              — create booking (walk-in / phone)
PATCH  /api/admin/bookings/{id}/confirm — accept a pending booking
PATCH  /api/admin/bookings/{id}/decline — decline with reason
PATCH  /api/admin/bookings/{id}/complete — mark confirmed → completed
GET    /api/admin/bookings/stats        — monthly summary
"""

import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic
from db.database import get_db
from db.models import (
    Booking,
    ClinicBlockedDate,
    ClinicFeatureStore,
    PatientProfile,
    Retreat,
)
from db.outcomes import append_outcome

router = APIRouter()

# ── Commission config ────────────────────────────────────────────────────────

_INTERNATIONAL_LANGS = {"ar", "de", "fr"}
_COMMISSION_INTERNATIONAL = 0.13
_COMMISSION_DOMESTIC = 0.07


# ── Pydantic models ──────────────────────────────────────────────────────────

class BookingListItem(BaseModel):
    id: str
    guest_name: str | None
    guest_email: str | None
    clinic_id: str
    retreat_id: str
    retreat_name: str
    start_date: str
    end_date: str
    nights: int
    guest_count: int
    status: str
    total_amount: float
    commission_amount: float
    currency: str
    payment_ref: str | None
    created_at: str


class BookingsPage(BaseModel):
    items: list[BookingListItem]
    total: int


class AdminBookingCreate(BaseModel):
    retreat_id: str
    start_date: date
    end_date: date
    guest_name: str = Field(min_length=1, max_length=200)
    guest_email: str | None = None
    guest_count: int = Field(default=1, ge=1, le=20)
    lang: str = Field(default="en", pattern="^(en|ar|de|fr|ml|hi)$")
    notes: str | None = None
    skip_availability_check: bool = False

    @model_validator(mode="after")
    def validate_dates(self) -> "AdminBookingCreate":
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class DeclineBody(BaseModel):
    reason: str


class BookingStats(BaseModel):
    bookings_this_month: int
    revenue_this_month: float
    pending_requests: int
    active_retreats: int


# ── Availability helpers ─────────────────────────────────────────────────────

async def _check_availability(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """Check for blocked dates in the date range.

    Returns a list of warning dicts. Empty list = all clear.
    """
    warnings = []

    # Check blocked dates
    blocked = (await db.execute(
        select(ClinicBlockedDate).where(
            ClinicBlockedDate.clinic_id == clinic_id,
            ClinicBlockedDate.blocked_date >= start_date,
            ClinicBlockedDate.blocked_date < end_date,
        )
    )).scalars().all()

    for bd in blocked:
        warnings.append({
            "type": "blocked",
            "date": str(bd.blocked_date),
            "reason": bd.reason or "Blocked",
        })

    # Check existing booking count for capacity
    existing_count = (await db.execute(
        select(func.count(Booking.id)).where(
            Booking.clinic_id == clinic_id,
            Booking.status.in_(["pending", "payment_received", "confirmed"]),
            Booking.start_date <= end_date,
            Booking.end_date >= start_date,
        )
    )).scalar_one()

    if existing_count >= 20:  # Simple capacity check
        warnings.append({
            "type": "capacity",
            "date": f"{start_date} to {end_date}",
            "reason": f"High booking volume ({existing_count} active bookings overlap)",
        })

    return warnings


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
        retreat = await db.get(Retreat, b.retreat_id) if b.retreat_id else None
        nights = (b.end_date - b.start_date).days if b.end_date and b.start_date else 0
        items.append(BookingListItem(
            id=str(b.id),
            guest_name=b.guest_name or f"Guest #{str(b.patient_pseudo_id)[:8]}",
            guest_email=b.guest_email,
            clinic_id=str(b.clinic_id),
            retreat_id=str(b.retreat_id) if b.retreat_id else "",
            retreat_name=retreat.name if retreat else "—",
            start_date=str(b.start_date),
            end_date=str(b.end_date),
            nights=nights,
            guest_count=b.guest_count or 1,
            status=b.status,
            total_amount=float(b.total_amount) if b.total_amount else 0.0,
            commission_amount=float(b.commission_amount) if b.commission_amount else 0.0,
            currency=b.currency or "USD",
            payment_ref=b.payment_ref,
            created_at=b.created_at.isoformat(),
        ))

    return BookingsPage(items=items, total=total)


@router.post("/bookings", status_code=201)
async def create_booking(
    body: AdminBookingCreate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    """Create a booking from the admin panel (walk-in, phone, or manual entry).

    Unlike the public booking API, this:
    - Creates the booking directly in 'confirmed' status
    - Does not require payment up-front
    - Validates availability unless skip_availability_check is set
    """
    retreat_uuid = uuid.UUID(body.retreat_id)

    # Validate retreat belongs to this clinic
    retreat = (await db.execute(
        select(Retreat).where(
            Retreat.id == retreat_uuid,
            Retreat.clinic_id == clinic.id,
            Retreat.is_active.is_(True),
        )
    )).scalar_one_or_none()
    if not retreat:
        raise HTTPException(status_code=422, detail="Retreat not found or inactive.")

    # Check availability
    availability_warnings = []
    if not body.skip_availability_check:
        availability_warnings = await _check_availability(db, clinic.id, body.start_date, body.end_date)
        hard_blocks = [w for w in availability_warnings if w["type"] == "blocked"]
        if hard_blocks:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Booking dates conflict with clinic availability",
                    "conflicts": hard_blocks,
                },
            )

    # Calculate financials
    nights = (body.end_date - body.start_date).days
    total_amount = round(float(retreat.price_usd) * nights * body.guest_count, 2)
    rate = _COMMISSION_INTERNATIONAL if body.lang in _INTERNATIONAL_LANGS else _COMMISSION_DOMESTIC
    commission_amount = round(total_amount * rate, 2)

    # Create or find patient profile
    pseudo_id = f"admin-{uuid.uuid4().hex[:12]}"
    db.add(PatientProfile(pseudo_id=pseudo_id, language=body.lang))
    await db.flush()

    booking = Booking(
        id=uuid.uuid4(),
        patient_pseudo_id=pseudo_id,
        clinic_id=clinic.id,
        retreat_id=retreat_uuid,
        guest_name=body.guest_name,
        guest_email=body.guest_email,
        guest_count=body.guest_count,
        start_date=body.start_date,
        end_date=body.end_date,
        status="confirmed",
        total_amount=total_amount,
        commission_amount=commission_amount,
        currency="USD",
        lang=body.lang,
        cancellation_policy="Admin-created booking — cancellation at clinic discretion.",
    )
    db.add(booking)

    await append_outcome(
        db,
        event_type="booking_confirmed",
        patient_pseudo_id=pseudo_id,
        clinic_id=clinic.id,
        booking_status="confirmed",
        scores={
            "total_amount": total_amount,
            "nights": nights,
            "retreat_name": retreat.name,
            "lang": body.lang,
            "source": "admin_manual",
        },
    )

    await db.commit()

    return {
        "id": str(booking.id),
        "status": "confirmed",
        "retreat_name": retreat.name,
        "guest_name": body.guest_name,
        "guest_count": body.guest_count,
        "start_date": str(body.start_date),
        "end_date": str(body.end_date),
        "nights": nights,
        "total_amount": total_amount,
        "commission_amount": commission_amount,
        "currency": "USD",
        "availability_warnings": availability_warnings,
    }


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
        booking_status="confirmed",
    )

    await db.commit()
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
        booking_status="completed",
    )

    await db.commit()
    return {"id": booking_id, "status": "completed"}


@router.get("/bookings/stats", response_model=BookingStats)
async def get_booking_stats(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    month_start = today.replace(day=1)

    month_q = select(Booking).where(
        Booking.clinic_id == clinic.id,
        Booking.created_at >= datetime(month_start.year, month_start.month, month_start.day, tzinfo=timezone.utc),
    )
    month_bookings = (await db.execute(month_q)).scalars().all()

    bookings_this_month = len(month_bookings)
    revenue = sum(float(b.total_amount or 0) for b in month_bookings if b.status in ("confirmed", "completed", "payment_received"))
    pending_requests = sum(1 for b in month_bookings if b.status == "pending")

    active_retreats_count = (await db.execute(
        select(func.count(Retreat.id)).where(
            Retreat.clinic_id == clinic.id,
            Retreat.is_active.is_(True),
        )
    )).scalar_one()

    return BookingStats(
        bookings_this_month=bookings_this_month,
        revenue_this_month=round(revenue, 2),
        pending_requests=pending_requests,
        active_retreats=active_retreats_count,
    )
