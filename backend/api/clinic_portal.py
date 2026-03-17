"""
api/clinic_portal.py — Clinic staff portal endpoints.

All routes require role = 'clinic_admin' (or 'platform_admin').
Clinic admins see only their own clinic's data.
Platform admins see all clinics.

GET  /api/clinic/me                      — current clinic info
GET  /api/clinic/dashboard               — KPI summary (pending count, arrivals, revenue)
GET  /api/clinic/bookings                — booking list (status filter, pagination)
GET  /api/clinic/bookings/{id}           — booking detail with patient Prakriti
POST /api/clinic/bookings/{id}/confirm   — confirm a pending booking
POST /api/clinic/bookings/{id}/decline   — decline a pending booking
"""

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user
from db.database import get_db
from db.models import Booking, ClinicBlockedDate, ClinicFeatureStore, Doctor, PatientProfile, Treatment, User

router = APIRouter(prefix="/api/clinic", tags=["clinic-portal"])


# ── Auth dependency ────────────────────────────────────────────────────────────

async def get_portal_user(
    user: User = Depends(get_current_user),
) -> User:
    if user.role not in ("clinic_admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Clinic staff access required")
    if user.role == "clinic_admin" and user.clinic_id is None:
        raise HTTPException(status_code=403, detail="No clinic linked to this account. Contact Vaidya support.")
    return user


# ── Pydantic models ────────────────────────────────────────────────────────────

class ClinicOut(BaseModel):
    id: str
    slug: str
    name: str
    tier: int
    district: str | None
    rating: float | None
    review_count: int
    specialisations: list[str]
    certifications: list[str]
    outcome_enrolled: bool


class DashboardStats(BaseModel):
    pending_count: int
    confirmed_count: int
    arriving_today: int
    arriving_this_week: int
    revenue_pending: float       # total_amount of confirmed bookings not yet completed


class BookingListItem(BaseModel):
    id: str
    patient_display: str         # guest_email or masked pseudo_id
    treatment_name: str
    start_date: str
    end_date: str
    duration_days: int
    status: str
    lang: str
    prakriti_type: str | None    # from patient_profile
    total_amount: float | None
    currency: str
    created_at: str


class BookingDetail(BaseModel):
    id: str
    patient_display: str
    patient_lang: str
    treatment_name: str
    treatment_description: str | None
    start_date: str
    end_date: str
    duration_days: int
    status: str
    lang: str
    total_amount: float | None
    commission_amount: float | None
    currency: str
    cancellation_policy: str | None
    created_at: str
    # Patient Prakriti
    prakriti_type: str | None
    vata_pct: int | None
    pitta_pct: int | None
    kapha_pct: int | None
    # Doctor
    doctor_name: str | None
    doctor_qualification: str | None


class BookingsPage(BaseModel):
    items: list[BookingListItem]
    total: int
    pending_count: int


# ── Helpers ────────────────────────────────────────────────────────────────────

def _clinic_filter(user: User):
    """Return the clinic_id to filter by, or None for platform_admin (all clinics)."""
    if user.role == "platform_admin":
        return None
    return user.clinic_id


def _booking_to_list_item(b: Booking, patient: PatientProfile | None) -> BookingListItem:
    start = b.start_date
    end = b.end_date
    duration = (end - start).days if start and end else 0
    return BookingListItem(
        id=str(b.id),
        patient_display=b.guest_email or f"Guest #{str(b.patient_pseudo_id)[:8]}",
        treatment_name=b.treatment.name if b.treatment else "—",
        start_date=str(start),
        end_date=str(end),
        duration_days=duration,
        status=b.status,
        lang=b.lang,
        prakriti_type=patient.dosha_type if patient else None,
        total_amount=float(b.total_amount) if b.total_amount else None,
        currency=b.currency,
        created_at=b.created_at.isoformat(),
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/me", response_model=ClinicOut)
async def get_my_clinic(
    user: User = Depends(get_portal_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = user.clinic_id
    if clinic_id is None:
        # platform_admin — return a placeholder
        raise HTTPException(status_code=404, detail="No clinic linked")

    clinic = await db.get(ClinicFeatureStore, clinic_id)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    return ClinicOut(
        id=str(clinic.id),
        slug=clinic.slug,
        name=clinic.name,
        tier=clinic.tier,
        district=clinic.district,
        rating=clinic.rating,
        review_count=clinic.review_count,
        specialisations=clinic.specialisations or [],
        certifications=clinic.certifications or [],
        outcome_enrolled=clinic.outcome_enrolled,
    )


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(
    user: User = Depends(get_portal_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _clinic_filter(user)
    today = date.today()

    def base_q():
        q = select(Booking)
        if clinic_id:
            q = q.where(Booking.clinic_id == clinic_id)
        return q

    pending_q = await db.execute(
        base_q().where(Booking.status == "pending")
    )
    pending_count = len(pending_q.scalars().all())

    confirmed_q = await db.execute(
        base_q().where(Booking.status == "confirmed")
    )
    confirmed = confirmed_q.scalars().all()
    confirmed_count = len(confirmed)

    arriving_today = sum(1 for b in confirmed if b.start_date == today)

    from datetime import timedelta
    week_end = today + timedelta(days=7)
    arriving_this_week = sum(1 for b in confirmed if today <= b.start_date <= week_end)

    revenue_pending = sum(
        float(b.total_amount or 0) for b in confirmed
        if b.status == "confirmed" and b.total_amount
    )

    return DashboardStats(
        pending_count=pending_count,
        confirmed_count=confirmed_count,
        arriving_today=arriving_today,
        arriving_this_week=arriving_this_week,
        revenue_pending=revenue_pending,
    )


@router.get("/bookings", response_model=BookingsPage)
async def list_bookings(
    status: str | None = None,
    page: int = 1,
    limit: int = 20,
    user: User = Depends(get_portal_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _clinic_filter(user)
    offset = (page - 1) * limit

    q = select(Booking)
    if clinic_id:
        q = q.where(Booking.clinic_id == clinic_id)
    if status and status != "all":
        q = q.where(Booking.status == status)

    # Total count
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    # Pending count (for sidebar badge)
    pending_q = select(func.count(Booking.id)).where(
        Booking.clinic_id == clinic_id if clinic_id else True,
        Booking.status == "pending",
    )
    pending_count = (await db.execute(pending_q)).scalar_one()

    # Paginated results, newest first
    results = (await db.execute(
        q.order_by(Booking.created_at.desc()).offset(offset).limit(limit)
    )).scalars().all()

    items = []
    for b in results:
        patient = await db.get(PatientProfile, b.patient_pseudo_id) if b.patient_pseudo_id else None
        items.append(_booking_to_list_item(b, patient))

    return BookingsPage(items=items, total=total, pending_count=pending_count)


@router.get("/bookings/{booking_id}", response_model=BookingDetail)
async def get_booking(
    booking_id: str,
    user: User = Depends(get_portal_user),
    db: AsyncSession = Depends(get_db),
):
    booking = await db.get(Booking, uuid.UUID(booking_id))
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    clinic_id = _clinic_filter(user)
    if clinic_id and booking.clinic_id != clinic_id:
        raise HTTPException(status_code=403, detail="Not your clinic's booking")

    patient = await db.get(PatientProfile, booking.patient_pseudo_id) if booking.patient_pseudo_id else None
    doctor = await db.get(Doctor, booking.doctor_id) if booking.doctor_id else None
    treatment = await db.get(Treatment, booking.treatment_id) if booking.treatment_id else None

    prakriti_scores = patient.prakriti_scores if patient else {}
    start = booking.start_date
    end = booking.end_date
    duration = (end - start).days if start and end else 0

    return BookingDetail(
        id=str(booking.id),
        patient_display=booking.guest_email or f"Guest #{str(booking.patient_pseudo_id)[:8]}",
        patient_lang=patient.language if patient else booking.lang,
        treatment_name=treatment.name if treatment else "—",
        treatment_description=treatment.description if treatment else None,
        start_date=str(start),
        end_date=str(end),
        duration_days=duration,
        status=booking.status,
        lang=booking.lang,
        total_amount=float(booking.total_amount) if booking.total_amount else None,
        commission_amount=float(booking.commission_amount) if booking.commission_amount else None,
        currency=booking.currency,
        cancellation_policy=booking.cancellation_policy,
        created_at=booking.created_at.isoformat(),
        prakriti_type=patient.dosha_type if patient else None,
        vata_pct=prakriti_scores.get("vata") if prakriti_scores else None,
        pitta_pct=prakriti_scores.get("pitta") if prakriti_scores else None,
        kapha_pct=prakriti_scores.get("kapha") if prakriti_scores else None,
        doctor_name=doctor.name if doctor else None,
        doctor_qualification=doctor.qualification if doctor else None,
    )


@router.post("/bookings/{booking_id}/confirm")
async def confirm_booking(
    booking_id: str,
    user: User = Depends(get_portal_user),
    db: AsyncSession = Depends(get_db),
):
    booking = await db.get(Booking, uuid.UUID(booking_id))
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    clinic_id = _clinic_filter(user)
    if clinic_id and booking.clinic_id != clinic_id:
        raise HTTPException(status_code=403, detail="Not your clinic's booking")

    if booking.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot confirm a booking with status '{booking.status}'")

    booking.status = "confirmed"
    booking.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {"id": booking_id, "status": "confirmed"}


@router.get("/availability")
async def get_availability(
    year: int,
    month: int,
    user: User = Depends(get_portal_user),
    db: AsyncSession = Depends(get_db),
):
    """Return blocked dates for the clinic in a given year/month."""
    clinic_id = user.clinic_id
    if clinic_id is None and user.role == "platform_admin":
        raise HTTPException(status_code=400, detail="platform_admin must specify a clinic_id")

    from datetime import date as _date
    import calendar
    _, days_in_month = calendar.monthrange(year, month)
    month_start = _date(year, month, 1)
    month_end = _date(year, month, days_in_month)

    q = select(ClinicBlockedDate).where(
        ClinicBlockedDate.clinic_id == clinic_id,
        ClinicBlockedDate.blocked_date >= month_start,
        ClinicBlockedDate.blocked_date <= month_end,
    )
    rows = (await db.execute(q)).scalars().all()

    return {
        "year": year,
        "month": month,
        "blocked": [
            {"date": str(r.blocked_date), "reason": r.reason}
            for r in rows
        ],
    }


class BlockDateRequest(BaseModel):
    dates: list[str]   # ISO date strings YYYY-MM-DD
    reason: str | None = None


@router.post("/availability/block")
async def block_dates(
    body: BlockDateRequest,
    user: User = Depends(get_portal_user),
    db: AsyncSession = Depends(get_db),
):
    """Block one or more dates for the clinic."""
    clinic_id = user.clinic_id
    if clinic_id is None:
        raise HTTPException(status_code=400, detail="No clinic linked to this account")

    from datetime import date as _date
    added = []
    for ds in body.dates:
        d = _date.fromisoformat(ds)
        # Upsert — ignore if already blocked
        existing = (await db.execute(
            select(ClinicBlockedDate).where(
                ClinicBlockedDate.clinic_id == clinic_id,
                ClinicBlockedDate.blocked_date == d,
            )
        )).scalar_one_or_none()
        if not existing:
            row = ClinicBlockedDate(clinic_id=clinic_id, blocked_date=d, reason=body.reason)
            db.add(row)
            added.append(ds)

    await db.commit()
    return {"added": added, "count": len(added)}


@router.delete("/availability/{blocked_date_str}")
async def unblock_date(
    blocked_date_str: str,
    user: User = Depends(get_portal_user),
    db: AsyncSession = Depends(get_db),
):
    """Unblock a date for the clinic."""
    clinic_id = user.clinic_id
    if clinic_id is None:
        raise HTTPException(status_code=400, detail="No clinic linked to this account")

    from datetime import date as _date
    d = _date.fromisoformat(blocked_date_str)
    row = (await db.execute(
        select(ClinicBlockedDate).where(
            ClinicBlockedDate.clinic_id == clinic_id,
            ClinicBlockedDate.blocked_date == d,
        )
    )).scalar_one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="Date not blocked")

    await db.delete(row)
    await db.commit()
    return {"unblocked": blocked_date_str}


@router.post("/bookings/{booking_id}/decline")
async def decline_booking(
    booking_id: str,
    user: User = Depends(get_portal_user),
    db: AsyncSession = Depends(get_db),
):
    booking = await db.get(Booking, uuid.UUID(booking_id))
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    clinic_id = _clinic_filter(user)
    if clinic_id and booking.clinic_id != clinic_id:
        raise HTTPException(status_code=403, detail="Not your clinic's booking")

    if booking.status not in ("pending", "confirmed"):
        raise HTTPException(status_code=400, detail=f"Cannot decline a booking with status '{booking.status}'")

    booking.status = "cancelled"
    booking.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {"id": booking_id, "status": "cancelled"}
