"""
api/admin/bookings.py — Booking management for clinic admins.

GET    /api/admin/bookings              — list bookings (filterable by status)
POST   /api/admin/bookings              — create booking (walk-in / phone)
PATCH  /api/admin/bookings/{id}/confirm — accept a pending booking
PATCH  /api/admin/bookings/{id}/decline — decline with reason
PATCH  /api/admin/bookings/{id}/complete — mark confirmed → completed
PATCH  /api/admin/bookings/{id}/assign-doctor — assign or change doctor
GET    /api/admin/bookings/stats        — monthly summary
"""

import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic
from db.database import get_db
from db.models import (
    Booking,
    ClinicAvailabilitySlot,
    ClinicBlockedDate,
    ClinicFeatureStore,
    Doctor,
    DoctorTreatment,
    PatientProfile,
    Treatment,
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
    patient_name: str
    patient_email: str
    clinic_id: str
    doctor_id: str | None
    doctor_name: str | None
    treatment_id: str | None
    treatment_name: str
    start_date: str
    end_date: str
    nights: int
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
    treatment_id: str
    doctor_id: str | None = None
    start_date: date
    end_date: date
    guest_name: str = Field(min_length=1, max_length=200)
    guest_email: str | None = None
    guest_phone: str | None = None
    lang: str = Field(default="en", pattern="^(en|ar|de|fr|ml|hi)$")
    notes: str | None = None
    skip_availability_check: bool = False

    @model_validator(mode="after")
    def validate_dates(self) -> "AdminBookingCreate":
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class AssignDoctorBody(BaseModel):
    doctor_id: str


class DeclineBody(BaseModel):
    reason: str


class BookingStats(BaseModel):
    bookings_this_month: int
    revenue_this_month: float
    pending_requests: int
    active_doctors: int


# ── Availability helpers ─────────────────────────────────────────────────────

async def _check_availability(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """Check for blocked dates and slot capacity issues in the date range.

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

    # Check availability slots
    slots = (await db.execute(
        select(ClinicAvailabilitySlot).where(
            ClinicAvailabilitySlot.clinic_id == clinic_id,
            ClinicAvailabilitySlot.slot_date >= start_date,
            ClinicAvailabilitySlot.slot_date < end_date,
        )
    )).scalars().all()

    for slot in slots:
        if slot.is_closed:
            warnings.append({
                "type": "closed",
                "date": str(slot.slot_date),
                "reason": slot.close_reason or "Clinic closed",
            })

    # Check existing booking count per date for capacity
    existing_count = (await db.execute(
        select(func.count(Booking.id)).where(
            Booking.clinic_id == clinic_id,
            Booking.status.in_(["pending", "payment_received", "confirmed"]),
            Booking.start_date <= end_date,
            Booking.end_date >= start_date,
        )
    )).scalar_one()

    # If any configured slot exists, check against lowest capacity
    if slots:
        min_capacity = min(s.total_slots for s in slots if not s.is_closed) if any(not s.is_closed for s in slots) else 0
        if min_capacity > 0 and existing_count >= min_capacity:
            warnings.append({
                "type": "capacity",
                "date": f"{start_date} to {end_date}",
                "reason": f"At or near capacity ({existing_count} active bookings, {min_capacity} slots)",
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
        treatment = await db.get(Treatment, b.treatment_id) if b.treatment_id else None
        doctor = await db.get(Doctor, b.doctor_id) if b.doctor_id else None
        patient_label = b.guest_email or f"Guest #{str(b.patient_pseudo_id)[:8]}"
        nights = (b.end_date - b.start_date).days if b.end_date and b.start_date else 0
        items.append(BookingListItem(
            id=str(b.id),
            patient_name=patient_label,
            patient_email=b.guest_email or "",
            clinic_id=str(b.clinic_id),
            doctor_id=str(b.doctor_id) if b.doctor_id else None,
            doctor_name=doctor.name if doctor else None,
            treatment_id=str(b.treatment_id) if b.treatment_id else None,
            treatment_name=treatment.name if treatment else "—",
            start_date=str(b.start_date),
            end_date=str(b.end_date),
            nights=nights,
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
    treatment_uuid = uuid.UUID(body.treatment_id)
    doctor_uuid = uuid.UUID(body.doctor_id) if body.doctor_id else None

    # Validate treatment belongs to this clinic
    treatment = (await db.execute(
        select(Treatment).where(
            Treatment.id == treatment_uuid,
            Treatment.clinic_id == clinic.id,
            Treatment.is_active.is_(True),
        )
    )).scalar_one_or_none()
    if not treatment:
        raise HTTPException(status_code=422, detail="Treatment not found or inactive.")

    # Validate doctor if specified
    doctor = None
    if doctor_uuid:
        doctor = (await db.execute(
            select(Doctor).where(
                Doctor.id == doctor_uuid,
                Doctor.clinic_id == clinic.id,
                Doctor.is_active.is_(True),
            )
        )).scalar_one_or_none()
        if not doctor:
            raise HTTPException(status_code=422, detail="Doctor not found or inactive.")

        # Validate doctor-treatment link if treatment has specific doctors
        dt_links = (await db.execute(
            select(DoctorTreatment).where(DoctorTreatment.treatment_id == treatment_uuid).limit(1)
        )).scalar_one_or_none()
        if dt_links:
            allowed = (await db.execute(
                select(DoctorTreatment).where(
                    DoctorTreatment.treatment_id == treatment_uuid,
                    DoctorTreatment.doctor_id == doctor_uuid,
                )
            )).scalar_one_or_none()
            if not allowed:
                raise HTTPException(status_code=422, detail="Doctor is not linked to this treatment.")

    # Check availability
    availability_warnings = []
    if not body.skip_availability_check:
        availability_warnings = await _check_availability(db, clinic.id, body.start_date, body.end_date)
        # Block on hard failures (blocked dates, closed dates)
        hard_blocks = [w for w in availability_warnings if w["type"] in ("blocked", "closed")]
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
    price_per_day = float(treatment.price_per_day) if treatment.price_per_day else 0.0
    total_amount = round(price_per_day * nights, 2)
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
        doctor_id=doctor_uuid,
        treatment_id=treatment_uuid,
        guest_email=body.guest_email,
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
        doctor_id=doctor_uuid,
        booking_status="confirmed",
        scores={
            "total_amount": total_amount,
            "nights": nights,
            "treatment_slug": treatment.slug,
            "lang": body.lang,
            "source": "admin_manual",
        },
    )

    await db.commit()

    return {
        "id": str(booking.id),
        "status": "confirmed",
        "treatment_name": treatment.name,
        "doctor_name": doctor.name if doctor else None,
        "guest_name": body.guest_name,
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
        doctor_id=booking.doctor_id,
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
        doctor_id=booking.doctor_id,
        booking_status="completed",
    )

    await db.commit()
    return {
        "id": booking_id,
        "status": "completed",
    }


@router.patch("/bookings/{booking_id}/assign-doctor")
async def assign_doctor(
    booking_id: str,
    body: AssignDoctorBody,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    """Assign or change the doctor on a booking."""
    booking = await db.get(Booking, uuid.UUID(booking_id))
    if not booking or booking.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Cannot assign doctor to {booking.status} booking")

    doctor_uuid = uuid.UUID(body.doctor_id)
    doctor = (await db.execute(
        select(Doctor).where(
            Doctor.id == doctor_uuid,
            Doctor.clinic_id == clinic.id,
            Doctor.is_active.is_(True),
        )
    )).scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=422, detail="Doctor not found or inactive.")

    # Validate doctor-treatment link if treatment has specific doctors
    if booking.treatment_id:
        dt_links = (await db.execute(
            select(DoctorTreatment).where(DoctorTreatment.treatment_id == booking.treatment_id).limit(1)
        )).scalar_one_or_none()
        if dt_links:
            allowed = (await db.execute(
                select(DoctorTreatment).where(
                    DoctorTreatment.treatment_id == booking.treatment_id,
                    DoctorTreatment.doctor_id == doctor_uuid,
                )
            )).scalar_one_or_none()
            if not allowed:
                raise HTTPException(status_code=422, detail="Doctor is not linked to this treatment.")

    booking.doctor_id = doctor_uuid
    booking.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "id": booking_id,
        "doctor_id": str(doctor_uuid),
        "doctor_name": doctor.name,
    }


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

    active_doctor_ids = {b.doctor_id for b in month_bookings if b.doctor_id and b.status in ("pending", "confirmed")}

    return BookingStats(
        bookings_this_month=bookings_this_month,
        revenue_this_month=round(revenue, 2),
        pending_requests=pending_requests,
        active_doctors=len(active_doctor_ids),
    )
