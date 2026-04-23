"""
api/booking.py — Booking flow (package-based, mock payment mode).
"""

import logging
import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.pricing import retreat_effective_inr
from db.database import get_db
from db.models import Booking, BookingAddOn, ClinicExperience, ClinicFeatureStore, Experience, Retreat, RetreatAvailability, PatientProfile, Room
from db.outcomes import append_outcome

logger = logging.getLogger(__name__)

router = APIRouter(tags=["bookings"])

_INTERNATIONAL_LANGS = {"ar", "de", "fr"}
_COMMISSION_INTERNATIONAL = 0.13
_COMMISSION_DOMESTIC = 0.07


class AddOnRequest(BaseModel):
    experience_id: str
    add_on_type: str = Field(pattern="^(platform|clinic)$")
    quantity: int = Field(default=1, ge=1)


class BookingAddOnOut(BaseModel):
    id: str
    add_on_type: str
    experience_id: str
    name_snapshot: str
    price_inr_snapshot: float
    quantity: int
    line_total_inr: float


class BookingRequest(BaseModel):
    retreat_id: str
    clinic_id: str
    start_date: date
    guest_count: int = Field(default=1, ge=1, le=10)
    patient_pseudo_id: str | None = Field(default=None, max_length=64)
    guest_name: str | None = None
    guest_email: str | None = None
    lang: str = Field(default="en", pattern="^(en|ar|de|fr|ml|hi)$")
    add_ons: list[AddOnRequest] = []
    room_id: str | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "BookingRequest":
        if self.start_date < date.today():
            raise ValueError("start_date must be today or in the future")
        return self


class BookingRequestResponse(BaseModel):
    booking_id: str
    status: str
    total_amount: float
    commission_amount: float
    currency: str
    nights: int
    clinic_name: str
    retreat_name: str
    start_date: date
    end_date: date
    add_ons: list[BookingAddOnOut] = []
    add_ons_total_inr: float = 0.0
    room_name_snapshot: str | None = None
    room_price_inr_snapshot: float | None = None


class PaymentResponse(BaseModel):
    booking_id: str
    status: str
    checkout_url: str | None
    total_amount: float
    currency: str
    message: str


class BookingDetail(BaseModel):
    id: str
    status: str
    patient_pseudo_id: str
    clinic_id: str
    clinic_name: str | None
    retreat_id: str
    retreat_name: str | None
    start_date: date
    end_date: date
    nights: int
    guest_count: int
    guest_name: str | None
    guest_email: str | None
    total_amount: float | None
    commission_amount: float | None
    currency: str
    lang: str
    payment_ref: str | None
    stripe_session_id: str | None
    created_at: datetime
    updated_at: datetime


def _commission_rate(lang: str) -> float:
    return _COMMISSION_INTERNATIONAL if lang in _INTERNATIONAL_LANGS else _COMMISSION_DOMESTIC


async def _fetch_booking_with_relations(booking_id: str, db: AsyncSession):
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid booking ID.")

    row = (await db.execute(
        select(Booking, ClinicFeatureStore, Retreat)
        .join(ClinicFeatureStore, Booking.clinic_id == ClinicFeatureStore.id)
        .join(Retreat, Booking.retreat_id == Retreat.id)
        .where(Booking.id == bid)
    )).one_or_none()

    if row is None:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found.")
    return row


@router.post("/api/bookings/request", response_model=BookingRequestResponse, status_code=201)
async def request_booking(
    body: BookingRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        clinic_uuid = uuid.UUID(body.clinic_id)
        retreat_uuid = uuid.UUID(body.retreat_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="clinic_id and retreat_id must be valid UUIDs.")

    package = (await db.execute(
        select(Retreat).where(
            Retreat.id == retreat_uuid,
            Retreat.clinic_id == clinic_uuid,
            Retreat.is_active.is_(True),
        )
    )).scalar_one_or_none()

    if package is None:
        raise HTTPException(status_code=422, detail="Retreat not found or does not belong to this clinic.")

    clinic = (await db.execute(select(ClinicFeatureStore).where(ClinicFeatureStore.id == clinic_uuid))).scalar_one_or_none()
    if clinic is None:
        raise HTTPException(status_code=422, detail="Clinic not found.")

    # Check availability
    avail = (await db.execute(
        select(RetreatAvailability).where(
            RetreatAvailability.retreat_id == retreat_uuid,
            RetreatAvailability.date == body.start_date,
            RetreatAvailability.is_blocked.is_(False),
        )
    )).scalar_one_or_none()

    if avail and avail.available_spots < body.guest_count:
        raise HTTPException(status_code=409, detail="Not enough spots available on the selected date.")

    # ── Room (optional) ───────────────────────────────────────────────────────
    room_obj: Room | None = None
    room_price_inr_snap: float | None = None
    if body.room_id:
        try:
            room_uuid = uuid.UUID(body.room_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="room_id must be a valid UUID.")
        room_obj = (await db.execute(
            select(Room).where(
                Room.id == room_uuid,
                Room.clinic_id == clinic_uuid,
                Room.is_active.is_(True),
            )
        )).scalar_one_or_none()
        if room_obj is None:
            raise HTTPException(status_code=422, detail="Room not found or does not belong to this clinic.")
        room_price_inr_snap = float(room_obj.price_per_night_inr)

    # Financials — canonical totals in INR (payment processor may settle in AED/USD later)
    nights = package.duration_min_days
    end_date = body.start_date + __import__('datetime').timedelta(days=nights)
    price_inr = retreat_effective_inr(
        float(package.price_inr) if package.price_inr is not None else None,
        float(package.price_usd) if package.price_usd is not None else None,
    )
    room_total_inr = round(room_price_inr_snap * nights, 2) if room_price_inr_snap else 0.0
    total_amount = round(price_inr * body.guest_count + room_total_inr, 2)
    rate = _commission_rate(body.lang)
    commission_amount = round(total_amount * rate, 2)

    pseudo_id = body.patient_pseudo_id or f"anon-{uuid.uuid4().hex[:12]}"

    existing_patient = (await db.execute(
        select(PatientProfile).where(PatientProfile.pseudo_id == pseudo_id)
    )).scalar_one_or_none()
    if existing_patient is None:
        db.add(PatientProfile(pseudo_id=pseudo_id, language=body.lang))
        await db.flush()

    booking = Booking(
        id=uuid.uuid4(),
        patient_pseudo_id=pseudo_id,
        clinic_id=clinic_uuid,
        retreat_id=retreat_uuid,
        room_id=room_obj.id if room_obj else None,
        room_price_inr_snapshot=room_price_inr_snap,
        guest_name=body.guest_name,
        guest_email=body.guest_email,
        guest_count=body.guest_count,
        start_date=body.start_date,
        end_date=end_date,
        status="pending",
        total_amount=total_amount,
        commission_amount=commission_amount,
        currency="INR",
        lang=body.lang,
        cancellation_policy="Free cancellation up to 14 days before arrival. 50% charge within 14-7 days. No refund within 7 days.",
    )
    db.add(booking)
    await db.flush()  # flush to get booking.id before add-ons

    # ── Process add-ons ───────────────────────────────────────────────────────
    add_ons_total_inr = 0.0
    add_on_rows: list[BookingAddOn] = []

    for ao in body.add_ons:
        try:
            exp_uuid = uuid.UUID(ao.experience_id)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid experience_id: {ao.experience_id}")

        if ao.add_on_type == "clinic":
            exp_obj = (await db.execute(
                select(ClinicExperience).where(
                    ClinicExperience.id == exp_uuid,
                    ClinicExperience.clinic_id == clinic_uuid,
                    ClinicExperience.is_active.is_(True),
                )
            )).scalar_one_or_none()
            if exp_obj is None:
                raise HTTPException(status_code=422, detail=f"Clinic experience '{ao.experience_id}' not found.")
            if ao.quantity > exp_obj.max_per_booking:
                raise HTTPException(
                    status_code=422,
                    detail=f"Max quantity for '{exp_obj.name_en}' is {exp_obj.max_per_booking}.",
                )
            name_snap = exp_obj.name_en
            price_snap = float(exp_obj.price_inr)
        else:  # platform
            exp_obj = (await db.execute(
                select(Experience).where(
                    Experience.id == exp_uuid,
                    Experience.is_active.is_(True),
                )
            )).scalar_one_or_none()
            if exp_obj is None:
                raise HTTPException(status_code=422, detail=f"Platform experience '{ao.experience_id}' not found.")
            name_snap = exp_obj.name_en
            price_snap = float(exp_obj.price_inr)

        line_total = round(price_snap * ao.quantity, 2)
        add_ons_total_inr += line_total

        addon_row = BookingAddOn(
            booking_id=booking.id,
            add_on_type=ao.add_on_type,
            experience_id=exp_uuid,
            name_snapshot=name_snap,
            price_inr_snapshot=price_snap,
            quantity=ao.quantity,
        )
        db.add(addon_row)
        add_on_rows.append(addon_row)

    if add_ons_total_inr > 0:
        add_ons_total_inr = round(add_ons_total_inr, 2)
        total_amount = round(total_amount + add_ons_total_inr, 2)
        commission_amount = round(total_amount * rate, 2)
        booking.total_amount = total_amount
        booking.commission_amount = commission_amount

    # Decrement availability
    if avail:
        avail.available_spots = max(0, avail.available_spots - body.guest_count)

    await db.flush()

    if add_ons_total_inr > 0:
        await append_outcome(
            db,
            event_type="add_on_selected",
            clinic_id=clinic_uuid,
            scores={
                "add_on_count": len(add_on_rows),
                "add_ons_total_inr": add_ons_total_inr,
            },
            booking_status="pending",
        )

    add_on_out = [
        BookingAddOnOut(
            id=str(r.id),
            add_on_type=r.add_on_type,
            experience_id=str(r.experience_id),
            name_snapshot=r.name_snapshot,
            price_inr_snapshot=float(r.price_inr_snapshot),
            quantity=r.quantity,
            line_total_inr=round(float(r.price_inr_snapshot) * r.quantity, 2),
        )
        for r in add_on_rows
    ]

    return BookingRequestResponse(
        booking_id=str(booking.id), status=booking.status,
        total_amount=total_amount, commission_amount=commission_amount,
        currency="INR", nights=nights, clinic_name=clinic.name,
        retreat_name=package.name, start_date=body.start_date, end_date=end_date,
        add_ons=add_on_out, add_ons_total_inr=add_ons_total_inr,
        room_name_snapshot=room_obj.name if room_obj else None,
        room_price_inr_snapshot=room_price_inr_snap,
    )


@router.post("/api/bookings/{booking_id}/payment", response_model=PaymentResponse)
async def initiate_payment(
    booking_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    booking, clinic, package = await _fetch_booking_with_relations(booking_id, db)

    if booking.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot initiate payment: booking is already '{booking.status}'.")

    total_amount = float(booking.total_amount) if booking.total_amount is not None else 0.0

    # Mock payment
    booking.status = "payment_received"
    booking.payment_ref = f"MOCK-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{str(booking.id)[:8].upper()}"
    await db.flush()

    await append_outcome(
        db,
        event_type="booking_completed",
        patient_pseudo_id=booking.patient_pseudo_id,
        clinic_id=booking.clinic_id,
        scores={
            "total_amount": total_amount,
            "commission_amount": float(booking.commission_amount) if booking.commission_amount else 0.0,
            "currency": booking.currency,
            "nights": (booking.end_date - booking.start_date).days,
            "package_name": package.name,
            "lang": booking.lang,
            "payment_mode": "mock",
        },
        booking_status="payment_received",
    )

    return PaymentResponse(
        booking_id=str(booking.id), status=booking.status, checkout_url=None,
        total_amount=total_amount, currency=booking.currency,
        message="Mock payment processed — booking confirmed.",
    )


@router.post("/api/webhooks/stripe", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    stripe_signature: str | None = Header(default=None, alias="stripe-signature"),
):
    logger.debug("Stripe webhook received (mock mode). sig=%s", stripe_signature)
    return {"received": True}


@router.get("/api/bookings/{booking_id}", response_model=BookingDetail)
async def get_booking(
    booking_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    booking, clinic, package = await _fetch_booking_with_relations(booking_id, db)

    return BookingDetail(
        id=str(booking.id), status=booking.status,
        patient_pseudo_id=booking.patient_pseudo_id,
        clinic_id=str(booking.clinic_id), clinic_name=clinic.name,
        retreat_id=str(booking.retreat_id), retreat_name=package.name,
        start_date=booking.start_date, end_date=booking.end_date,
        nights=(booking.end_date - booking.start_date).days,
        guest_count=booking.guest_count,
        guest_name=booking.guest_name, guest_email=booking.guest_email,
        total_amount=float(booking.total_amount) if booking.total_amount is not None else None,
        commission_amount=float(booking.commission_amount) if booking.commission_amount is not None else None,
        currency=booking.currency, lang=booking.lang,
        payment_ref=booking.payment_ref, stripe_session_id=booking.stripe_session_id,
        created_at=booking.created_at, updated_at=booking.updated_at,
    )
