"""
api/users.py — User data endpoints.

All endpoints accept EITHER a Bearer token (authenticated user) OR read
session_id from request.state (guest). The get_identity() helper resolves
which identity to use — at least one is always present thanks to the
GuestSessionMiddleware.

GET    /api/users/me/preferences
POST   /api/users/me/preferences
GET    /api/users/me/watchlist?type=clinic|doctor
POST   /api/users/me/watchlist
DELETE /api/users/me/watchlist/{id}
GET    /api/users/me/bookings        (auth required)
GET    /api/users/me/consultations   (auth required)
GET    /api/users/me/prescriptions   (auth required)
GET    /api/users/me/prescriptions/{id}  (auth required)
GET    /api/users/me/purchases       (auth required)
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from db.database import get_db
from db.models import (
    BookingHistory,
    ConsultationHistory,
    Prescription,
    ProductPurchaseHistory,
    UserPreferences,
    UserWatchlist,
)

router = APIRouter(prefix="/api/users", tags=["users"])

_AUTH_REQUIRED_DETAIL = "Sign in to view your history"
_AUTH_REQUIRED_BODY = {"detail": _AUTH_REQUIRED_DETAIL, "sign_in_url": "/login"}


# ── Identity resolution ────────────────────────────────────────────────────────

def get_identity(request: Request) -> tuple[uuid.UUID | None, uuid.UUID | None]:
    """
    Returns (user_id, session_id).
    Reads user_id from Bearer token (if valid), session_id from request.state.
    At least session_id is always set (injected by GuestSessionMiddleware).
    """
    user_id: uuid.UUID | None = None
    session_id: uuid.UUID | None = getattr(request.state, "session_id", None)

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            payload = jwt.decode(
                auth_header.split(" ", 1)[1],
                settings.JWT_SECRET,
                algorithms=["HS256"],
            )
            if payload.get("type") == "access" and payload.get("sub"):
                user_id = uuid.UUID(payload["sub"])
        except (JWTError, ValueError):
            pass

    return user_id, session_id


def _require_auth(request: Request) -> uuid.UUID:
    """Raises 401 with a soft-nudge body if the request is unauthenticated."""
    user_id, _ = get_identity(request)
    if not user_id:
        raise HTTPException(status_code=401, detail=_AUTH_REQUIRED_DETAIL)
    return user_id


# ── Pydantic models ────────────────────────────────────────────────────────────

class PreferencesOut(BaseModel):
    vata_pct: int | None
    pitta_pct: int | None
    kapha_pct: int | None
    primary_type: str | None
    secondary_type: str | None
    assessment_id: str | None
    updated_at: datetime


class PreferencesIn(BaseModel):
    vata_pct: int
    pitta_pct: int
    kapha_pct: int
    primary_type: str
    secondary_type: str | None = None
    assessment_id: str | None = None


class WatchlistOut(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    notes: str | None
    created_at: datetime


class WatchlistIn(BaseModel):
    entity_type: str
    entity_id: str
    notes: str | None = None


class BookingHistoryOut(BaseModel):
    id: str
    booking_id: str
    clinic_id: str
    doctor_id: str
    treatment_name: str
    start_date: str
    end_date: str
    total_paid: float | None
    status: str
    created_at: datetime


class ConsultationOut(BaseModel):
    id: str
    doctor_id: str
    clinic_id: str
    consultation_date: datetime
    chief_complaint_en: str | None
    prakriti_at_consultation: str | None
    created_at: datetime


class PrescriptionOut(BaseModel):
    id: str
    consultation_id: str
    doctor_id: str
    prescription_date: str
    structured_data: dict | None
    medicines: dict | None
    diet_instructions_en: str | None
    follow_up_date: str | None
    pdf_url: str | None
    created_at: datetime


class PurchaseOut(BaseModel):
    id: str
    product_name: str
    product_slug: str
    quantity: int
    unit_price: float
    total_price: float
    currency: str
    status: str
    ordered_at: datetime


# ── Preferences ────────────────────────────────────────────────────────────────

@router.get("/me/preferences", response_model=PreferencesOut | None)
async def get_preferences(request: Request, db: AsyncSession = Depends(get_db)):
    user_id, session_id = get_identity(request)

    if user_id:
        result = await db.execute(
            select(UserPreferences).where(UserPreferences.user_id == user_id)
        )
    elif session_id:
        result = await db.execute(
            select(UserPreferences).where(UserPreferences.session_id == session_id)
        )
    else:
        return None

    prefs = result.scalar_one_or_none()
    if not prefs:
        return None

    return _prefs_out(prefs)


@router.post("/me/preferences", response_model=PreferencesOut)
async def upsert_preferences(
    body: PreferencesIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id, session_id = get_identity(request)
    if not user_id and not session_id:
        raise HTTPException(status_code=400, detail="No identity found")

    if user_id:
        result = await db.execute(
            select(UserPreferences).where(UserPreferences.user_id == user_id)
        )
    else:
        result = await db.execute(
            select(UserPreferences).where(UserPreferences.session_id == session_id)
        )
    prefs = result.scalar_one_or_none()

    assessment_uuid = uuid.UUID(body.assessment_id) if body.assessment_id else None
    now = datetime.now(timezone.utc)

    if prefs:
        prefs.prakriti_vata_pct = body.vata_pct
        prefs.prakriti_pitta_pct = body.pitta_pct
        prefs.prakriti_kapha_pct = body.kapha_pct
        prefs.prakriti_primary_type = body.primary_type
        prefs.prakriti_secondary_type = body.secondary_type
        prefs.prakriti_completed_at = now
        prefs.prakriti_assessment_id = assessment_uuid
    else:
        prefs = UserPreferences(
            user_id=user_id,
            session_id=session_id,
            prakriti_vata_pct=body.vata_pct,
            prakriti_pitta_pct=body.pitta_pct,
            prakriti_kapha_pct=body.kapha_pct,
            prakriti_primary_type=body.primary_type,
            prakriti_secondary_type=body.secondary_type,
            prakriti_completed_at=now,
            prakriti_assessment_id=assessment_uuid,
        )
        db.add(prefs)

    await db.flush()
    return _prefs_out(prefs)


def _prefs_out(prefs: UserPreferences) -> PreferencesOut:
    return PreferencesOut(
        vata_pct=prefs.prakriti_vata_pct,
        pitta_pct=prefs.prakriti_pitta_pct,
        kapha_pct=prefs.prakriti_kapha_pct,
        primary_type=prefs.prakriti_primary_type,
        secondary_type=prefs.prakriti_secondary_type,
        assessment_id=str(prefs.prakriti_assessment_id) if prefs.prakriti_assessment_id else None,
        updated_at=prefs.updated_at,
    )


# ── Watchlist ──────────────────────────────────────────────────────────────────

@router.get("/me/watchlist", response_model=list[WatchlistOut])
async def get_watchlist(
    request: Request,
    type: str | None = Query(None, alias="type"),
    db: AsyncSession = Depends(get_db),
):
    user_id, session_id = get_identity(request)

    if user_id:
        q = select(UserWatchlist).where(UserWatchlist.user_id == user_id)
    elif session_id:
        q = select(UserWatchlist).where(UserWatchlist.session_id == session_id)
    else:
        return []

    if type in ("clinic", "doctor"):
        q = q.where(UserWatchlist.entity_type == type)

    result = await db.execute(q.order_by(UserWatchlist.created_at.desc()))
    rows = result.scalars().all()

    return [
        WatchlistOut(
            id=str(r.id),
            entity_type=r.entity_type,
            entity_id=str(r.entity_id),
            notes=r.notes,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/me/watchlist", response_model=WatchlistOut, status_code=201)
async def add_to_watchlist(
    body: WatchlistIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id, session_id = get_identity(request)
    if not user_id and not session_id:
        raise HTTPException(status_code=400, detail="No identity found")

    if body.entity_type not in ("clinic", "doctor"):
        raise HTTPException(status_code=422, detail="entity_type must be 'clinic' or 'doctor'")

    try:
        entity_uuid = uuid.UUID(body.entity_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="entity_id must be a valid UUID")

    item = UserWatchlist(
        user_id=user_id,
        session_id=session_id,
        entity_type=body.entity_type,
        entity_id=entity_uuid,
        notes=body.notes,
    )
    db.add(item)
    await db.flush()

    return WatchlistOut(
        id=str(item.id),
        entity_type=item.entity_type,
        entity_id=str(item.entity_id),
        notes=item.notes,
        created_at=item.created_at,
    )


@router.delete("/me/watchlist/{item_id}", status_code=204)
async def remove_from_watchlist(
    item_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id, session_id = get_identity(request)

    try:
        item = await db.get(UserWatchlist, uuid.UUID(item_id))
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid watchlist item ID")

    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")

    owner_match = (user_id and item.user_id == user_id) or (
        session_id and item.session_id == session_id
    )
    if not owner_match:
        raise HTTPException(status_code=403, detail="Not your watchlist item")

    await db.delete(item)


# ── Auth-required history endpoints ───────────────────────────────────────────

@router.get("/me/bookings", response_model=list[BookingHistoryOut])
async def get_bookings(request: Request, db: AsyncSession = Depends(get_db)):
    user_id = _require_auth(request)
    result = await db.execute(
        select(BookingHistory)
        .where(BookingHistory.user_id == user_id)
        .order_by(BookingHistory.created_at.desc())
    )
    rows = result.scalars().all()
    return [
        BookingHistoryOut(
            id=str(r.id),
            booking_id=str(r.booking_id),
            clinic_id=str(r.clinic_id),
            doctor_id=str(r.doctor_id),
            treatment_name=r.treatment_name,
            start_date=str(r.start_date),
            end_date=str(r.end_date),
            total_paid=float(r.total_paid) if r.total_paid is not None else None,
            status=r.status,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/me/consultations", response_model=list[ConsultationOut])
async def get_consultations(request: Request, db: AsyncSession = Depends(get_db)):
    user_id = _require_auth(request)
    result = await db.execute(
        select(ConsultationHistory)
        .where(ConsultationHistory.user_id == user_id)
        .order_by(ConsultationHistory.consultation_date.desc())
    )
    rows = result.scalars().all()
    return [
        ConsultationOut(
            id=str(r.id),
            doctor_id=str(r.doctor_id),
            clinic_id=str(r.clinic_id),
            consultation_date=r.consultation_date,
            chief_complaint_en=r.chief_complaint_en,
            prakriti_at_consultation=r.prakriti_at_consultation,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/me/prescriptions", response_model=list[PrescriptionOut])
async def get_prescriptions(request: Request, db: AsyncSession = Depends(get_db)):
    user_id = _require_auth(request)
    result = await db.execute(
        select(Prescription)
        .where(Prescription.user_id == user_id)
        .order_by(Prescription.prescription_date.desc())
    )
    rows = result.scalars().all()
    return [_rx_out(r) for r in rows]


@router.get("/me/prescriptions/{prescription_id}", response_model=PrescriptionOut)
async def get_prescription(
    prescription_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = _require_auth(request)
    try:
        rx = await db.get(Prescription, uuid.UUID(prescription_id))
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid prescription ID")

    if not rx or rx.user_id != user_id:
        raise HTTPException(status_code=404, detail="Prescription not found")

    return _rx_out(rx)


@router.get("/me/purchases", response_model=list[PurchaseOut])
async def get_purchases(request: Request, db: AsyncSession = Depends(get_db)):
    user_id = _require_auth(request)
    result = await db.execute(
        select(ProductPurchaseHistory)
        .where(ProductPurchaseHistory.user_id == user_id)
        .order_by(ProductPurchaseHistory.ordered_at.desc())
    )
    rows = result.scalars().all()
    return [
        PurchaseOut(
            id=str(r.id),
            product_name=r.product_name,
            product_slug=r.product_slug,
            quantity=r.quantity,
            unit_price=float(r.unit_price),
            total_price=float(r.total_price),
            currency=r.currency,
            status=r.status,
            ordered_at=r.ordered_at,
        )
        for r in rows
    ]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _rx_out(r: Prescription) -> PrescriptionOut:
    return PrescriptionOut(
        id=str(r.id),
        consultation_id=str(r.consultation_id),
        doctor_id=str(r.doctor_id),
        prescription_date=str(r.prescription_date),
        structured_data=r.structured_data,
        medicines=r.medicines,
        diet_instructions_en=r.diet_instructions_en,
        follow_up_date=str(r.follow_up_date) if r.follow_up_date else None,
        pdf_url=r.pdf_url,
        created_at=r.created_at,
    )
