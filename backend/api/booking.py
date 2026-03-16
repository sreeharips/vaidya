"""
api/booking.py — Booking flow (mock payment mode).

Stripe / Razorpay integration is intentionally deferred.
POST /api/bookings/{id}/payment immediately marks the booking as paid
and logs the outcome without any external payment call.

When real payments are enabled:
  1. Uncomment the stripe.checkout.Session.create() block in `initiate_payment`.
  2. Uncomment signature verification in `stripe_webhook`.
  3. Remove the mock auto-confirm block in `initiate_payment`.
"""

import logging
import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import Booking, ClinicFeatureStore, Doctor, PatientProfile, Treatment
from db.outcomes import append_outcome

logger = logging.getLogger(__name__)

router = APIRouter(tags=["bookings"])

# ── Commission config ─────────────────────────────────────────────────────────

# Languages that indicate an international booking (Gulf / European patients)
_INTERNATIONAL_LANGS = {"ar", "de", "fr"}
_COMMISSION_INTERNATIONAL = 0.13   # 13 %
_COMMISSION_DOMESTIC = 0.07        # 7 %


# ── Pydantic models ───────────────────────────────────────────────────────────


class BookingRequest(BaseModel):
    clinic_id: str
    doctor_id: str
    treatment_id: str
    start_date: date
    end_date: date
    patient_pseudo_id: str | None = Field(default=None, max_length=64)
    lang: str = Field(default="en", pattern="^(en|ar|de|fr|ml|hi)$")

    @model_validator(mode="after")
    def validate_dates(self) -> "BookingRequest":
        today = date.today()
        if self.start_date < today:
            raise ValueError("start_date must be today or in the future")
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class BookingRequestResponse(BaseModel):
    booking_id: str
    status: str
    total_amount: float
    commission_amount: float
    currency: str
    nights: int
    clinic_name: str
    doctor_name: str
    treatment_name: str
    start_date: date
    end_date: date


class PaymentResponse(BaseModel):
    booking_id: str
    status: str
    # checkout_url will be a real Stripe URL when payments are enabled.
    # In mock mode it is always null.
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
    doctor_id: str
    doctor_name: str | None
    treatment_id: str
    treatment_name: str | None
    start_date: date
    end_date: date
    nights: int
    total_amount: float | None
    commission_amount: float | None
    currency: str
    lang: str
    payment_ref: str | None
    stripe_session_id: str | None
    created_at: datetime
    updated_at: datetime


# ── Helpers ───────────────────────────────────────────────────────────────────


def _commission_rate(lang: str) -> float:
    return _COMMISSION_INTERNATIONAL if lang in _INTERNATIONAL_LANGS else _COMMISSION_DOMESTIC


async def _fetch_booking_with_relations(booking_id: str, db: AsyncSession):
    """Return (Booking, ClinicFeatureStore, Doctor, Treatment) or raise 404."""
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid booking ID.")

    row = (
        await db.execute(
            select(Booking, ClinicFeatureStore, Doctor, Treatment)
            .join(ClinicFeatureStore, Booking.clinic_id == ClinicFeatureStore.id)
            .join(Doctor, Booking.doctor_id == Doctor.id)
            .join(Treatment, Booking.treatment_id == Treatment.id)
            .where(Booking.id == bid)
        )
    ).one_or_none()

    if row is None:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found.")
    return row


# ── POST /api/bookings/request ────────────────────────────────────────────────


@router.post("/api/bookings/request", response_model=BookingRequestResponse, status_code=201)
async def request_booking(
    body: BookingRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new booking in `pending` status.

    Validates that the treatment belongs to the specified clinic and doctor.
    Calculates `total_amount = price_per_day × nights` and locks it at booking time
    so future treatment price changes do not affect existing bookings.

    Commission rate:
    - 13 % for international bookings (lang = ar / de / fr)
    - 7 % for domestic bookings (lang = en / ml / hi)
    """
    try:
        clinic_uuid = uuid.UUID(body.clinic_id)
        doctor_uuid = uuid.UUID(body.doctor_id)
        treatment_uuid = uuid.UUID(body.treatment_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="clinic_id, doctor_id, and treatment_id must be valid UUIDs.")

    # Treatment must belong to exactly this clinic AND this doctor
    treatment = (
        await db.execute(
            select(Treatment).where(
                Treatment.id == treatment_uuid,
                Treatment.clinic_id == clinic_uuid,
                Treatment.doctor_id == doctor_uuid,
                Treatment.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()

    if treatment is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "Treatment not found, or it does not belong to the specified clinic and doctor. "
                "Verify treatment_id, clinic_id, and doctor_id."
            ),
        )

    clinic = (await db.execute(select(ClinicFeatureStore).where(ClinicFeatureStore.id == clinic_uuid))).scalar_one_or_none()
    doctor = (await db.execute(select(Doctor).where(Doctor.id == doctor_uuid, Doctor.is_active.is_(True)))).scalar_one_or_none()

    if clinic is None or doctor is None:
        raise HTTPException(status_code=422, detail="Clinic or doctor not found.")

    # ── Financials ────────────────────────────────────────────────────────────
    nights = (body.end_date - body.start_date).days
    price_per_day = float(treatment.price_per_day) if treatment.price_per_day else 0.0
    total_amount = round(price_per_day * nights, 2)
    rate = _commission_rate(body.lang)
    commission_amount = round(total_amount * rate, 2)

    cancellation_policy = (
        "Free cancellation up to 14 days before arrival. "
        "50% charge within 14–7 days. No refund within 7 days of arrival."
    )

    pseudo_id = body.patient_pseudo_id or f"anon-{uuid.uuid4().hex[:12]}"

    # Upsert patient profile so the FK constraint is satisfied
    existing_patient = (
        await db.execute(select(PatientProfile).where(PatientProfile.pseudo_id == pseudo_id))
    ).scalar_one_or_none()
    if existing_patient is None:
        db.add(PatientProfile(pseudo_id=pseudo_id, language=body.lang))
        await db.flush()

    booking = Booking(
        id=uuid.uuid4(),
        patient_pseudo_id=pseudo_id,
        clinic_id=clinic_uuid,
        doctor_id=doctor_uuid,
        treatment_id=treatment_uuid,
        start_date=body.start_date,
        end_date=body.end_date,
        status="pending",
        total_amount=total_amount,
        commission_amount=commission_amount,
        currency="USD",
        lang=body.lang,
        cancellation_policy=cancellation_policy,
    )
    db.add(booking)
    await db.flush()

    logger.info(
        "Booking created: id=%s patient=%s clinic=%s treatment=%s total=%.2f USD nights=%d",
        booking.id, pseudo_id, clinic.name, treatment.name, total_amount, nights,
    )

    return BookingRequestResponse(
        booking_id=str(booking.id),
        status=booking.status,
        total_amount=total_amount,
        commission_amount=commission_amount,
        currency="USD",
        nights=nights,
        clinic_name=clinic.name,
        doctor_name=doctor.name,
        treatment_name=treatment.name,
        start_date=body.start_date,
        end_date=body.end_date,
    )


# ── POST /api/bookings/{id}/payment ──────────────────────────────────────────


@router.post("/api/bookings/{booking_id}/payment", response_model=PaymentResponse)
async def initiate_payment(
    booking_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Process payment for a pending booking.

    ** MOCK MODE — Stripe integration pending **
    Payment is immediately confirmed without any external call.
    The booking transitions to `payment_received` and an outcome event is logged.

    To enable real Stripe payments:
    1. Set STRIPE_SECRET_KEY in .env.local
    2. Uncomment the STRIPE BLOCK below and remove the mock block.
    3. Handle checkout.session.completed in the webhook endpoint.
    """
    booking, clinic, doctor, treatment = await _fetch_booking_with_relations(booking_id, db)

    if booking.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot initiate payment: booking is already '{booking.status}'.",
        )

    total_amount = float(booking.total_amount) if booking.total_amount is not None else 0.0

    # ┌─────────────────────────────────────────────────────────────────────────┐
    # │  STRIPE BLOCK — uncomment to enable real payments                       │
    # └─────────────────────────────────────────────────────────────────────────┘
    # import stripe
    # from core.config import settings
    # stripe.api_key = settings.STRIPE_SECRET_KEY
    #
    # stripe_session = stripe.checkout.Session.create(
    #     mode="payment",
    #     line_items=[{
    #         "price_data": {
    #             "currency": booking.currency.lower(),
    #             "unit_amount": int(total_amount * 100),  # Stripe uses cents
    #             "product_data": {
    #                 "name": f"{treatment.name} — {clinic.name}",
    #                 "description": (
    #                     f"{(booking.end_date - booking.start_date).days} nights · "
    #                     f"Dr. {doctor.name} · "
    #                     f"{booking.start_date} to {booking.end_date}"
    #                 ),
    #             },
    #         },
    #         "quantity": 1,
    #     }],
    #     success_url=(
    #         f"{settings.NEXT_PUBLIC_APP_URL}/{booking.lang}/booking/success"
    #         f"?id={booking.id}"
    #     ),
    #     cancel_url=(
    #         f"{settings.NEXT_PUBLIC_APP_URL}/{booking.lang}/booking/cancel"
    #         f"?id={booking.id}"
    #     ),
    #     metadata={
    #         "booking_id": str(booking.id),
    #         "patient_pseudo_id": booking.patient_pseudo_id,
    #     },
    # )
    # booking.stripe_session_id = stripe_session.id
    # await db.flush()
    # return PaymentResponse(
    #     booking_id=str(booking.id),
    #     status=booking.status,  # still "pending" — webhook confirms it
    #     checkout_url=stripe_session.url,
    #     total_amount=total_amount,
    #     currency=booking.currency,
    #     message="Redirecting to Stripe Checkout.",
    # )

    # ┌─────────────────────────────────────────────────────────────────────────┐
    # │  MOCK BLOCK — remove when Stripe is enabled                             │
    # └─────────────────────────────────────────────────────────────────────────┘
    booking.status = "payment_received"
    booking.payment_ref = (
        f"MOCK-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{str(booking.id)[:8].upper()}"
    )
    await db.flush()

    await append_outcome(
        db,
        event_type="booking_completed",
        patient_pseudo_id=booking.patient_pseudo_id,
        clinic_id=booking.clinic_id,
        doctor_id=booking.doctor_id,
        scores={
            "total_amount": total_amount,
            "commission_amount": float(booking.commission_amount) if booking.commission_amount else 0.0,
            "currency": booking.currency,
            "nights": (booking.end_date - booking.start_date).days,
            "treatment_slug": treatment.slug,
            "lang": booking.lang,
            "payment_mode": "mock",
        },
        booking_status="payment_received",
    )

    # Confirmation email — placeholder until email service is wired
    logger.info(
        "[EMAIL] Confirmation → patient=%s | clinic=%s | doctor=%s | treatment=%s | "
        "%s → %s | total=%.2f %s | ref=%s",
        booking.patient_pseudo_id,
        clinic.name,
        doctor.name,
        treatment.name,
        booking.start_date,
        booking.end_date,
        total_amount,
        booking.currency,
        booking.payment_ref,
    )

    return PaymentResponse(
        booking_id=str(booking.id),
        status=booking.status,
        checkout_url=None,
        total_amount=total_amount,
        currency=booking.currency,
        message=(
            "Mock payment processed — booking confirmed. "
            "Stripe/Razorpay integration is pending; no real charge was made."
        ),
    )


# ── POST /api/webhooks/stripe ─────────────────────────────────────────────────


@router.post("/api/webhooks/stripe", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    stripe_signature: str | None = Header(default=None, alias="stripe-signature"),
):
    """Stripe webhook receiver — placeholder until Stripe is enabled.

    When enabled, handles `checkout.session.completed`:
    - Transitions booking pending → payment_received
    - Appends booking_completed to outcomes_log
    - Queues confirmation email

    To enable:
    1. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env.local
    2. Uncomment the verification and event-handling blocks below
    3. Register this URL in Stripe Dashboard → Webhooks
    """
    # ┌─────────────────────────────────────────────────────────────────────────┐
    # │  Stripe webhook handling — uncomment to enable                          │
    # └─────────────────────────────────────────────────────────────────────────┘
    # import stripe
    # from core.config import settings
    # stripe.api_key = settings.STRIPE_SECRET_KEY
    #
    # payload = await request.body()
    # if not stripe_signature:
    #     raise HTTPException(status_code=400, detail="Missing stripe-signature header.")
    # try:
    #     event = stripe.Webhook.construct_event(
    #         payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
    #     )
    # except stripe.error.SignatureVerificationError:
    #     raise HTTPException(status_code=400, detail="Invalid Stripe webhook signature.")
    # except ValueError:
    #     raise HTTPException(status_code=400, detail="Malformed webhook payload.")
    #
    # if event["type"] == "checkout.session.completed":
    #     session_obj = event["data"]["object"]
    #     booking_id = (session_obj.get("metadata") or {}).get("booking_id")
    #     if booking_id:
    #         try:
    #             booking = (await db.execute(
    #                 select(Booking).where(Booking.id == uuid.UUID(booking_id))
    #             )).scalar_one_or_none()
    #         except ValueError:
    #             booking = None
    #         if booking and booking.status == "pending":
    #             booking.status = "payment_received"
    #             booking.payment_ref = session_obj.get("payment_intent")
    #             await append_outcome(
    #                 db,
    #                 event_type="booking_completed",
    #                 patient_pseudo_id=booking.patient_pseudo_id,
    #                 clinic_id=booking.clinic_id,
    #                 doctor_id=booking.doctor_id,
    #                 booking_status="payment_received",
    #             )
    #             logger.info("[EMAIL] Stripe-confirmed booking %s queued for email", booking_id)

    logger.debug("Stripe webhook received (mock mode — no processing). sig=%s", stripe_signature)
    return {"received": True}


# ── GET /api/bookings/{id} ────────────────────────────────────────────────────


@router.get("/api/bookings/{booking_id}", response_model=BookingDetail)
async def get_booking(
    booking_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return current status and full details of a booking."""
    booking, clinic, doctor, treatment = await _fetch_booking_with_relations(booking_id, db)

    return BookingDetail(
        id=str(booking.id),
        status=booking.status,
        patient_pseudo_id=booking.patient_pseudo_id,
        clinic_id=str(booking.clinic_id),
        clinic_name=clinic.name,
        doctor_id=str(booking.doctor_id),
        doctor_name=doctor.name,
        treatment_id=str(booking.treatment_id),
        treatment_name=treatment.name,
        start_date=booking.start_date,
        end_date=booking.end_date,
        nights=(booking.end_date - booking.start_date).days,
        total_amount=float(booking.total_amount) if booking.total_amount is not None else None,
        commission_amount=float(booking.commission_amount) if booking.commission_amount is not None else None,
        currency=booking.currency,
        lang=booking.lang,
        payment_ref=booking.payment_ref,
        stripe_session_id=booking.stripe_session_id,
        created_at=booking.created_at,
        updated_at=booking.updated_at,
    )
