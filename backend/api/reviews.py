"""
api/reviews.py — Public review endpoints.

GET  /api/clinics/{slug}/reviews   All verified reviews for a clinic (with retreat name)
GET  /api/retreats/{id}/reviews    Verified reviews scoped to a specific retreat
POST /api/reviews                  Submit a new review (verified via booking_id + guest_email)
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import Booking, ClinicFeatureStore, Retreat, Review

router = APIRouter(tags=["reviews"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ReviewOut(BaseModel):
    id: str
    rating: int
    review_text: str | None
    reviewer_location: str | None
    retreat_id: str | None
    retreat_name: str | None
    verified: bool
    created_at: datetime


class ReviewListOut(BaseModel):
    total: int
    avg_rating: float | None
    reviews: list[ReviewOut]


class ReviewSubmit(BaseModel):
    booking_id: str
    guest_email: str
    rating: int = Field(..., ge=1, le=5)
    review_text: str | None = None
    reviewer_location: str | None = None


# ── GET /api/clinics/{slug}/reviews ──────────────────────────────────────────

@router.get("/api/clinics/{slug}/reviews", response_model=ReviewListOut)
async def get_clinic_reviews(
    slug: str,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> ReviewListOut:
    clinic_row = await db.execute(
        select(ClinicFeatureStore).where(
            ClinicFeatureStore.slug == slug,
            ClinicFeatureStore.is_active.is_(True),
        )
    )
    clinic = clinic_row.scalar_one_or_none()
    if clinic is None:
        raise HTTPException(status_code=404, detail="Clinic not found")

    # All verified reviews with optional retreat join
    rows = (await db.execute(
        select(Review, Retreat)
        .outerjoin(Retreat, Review.retreat_id == Retreat.id)
        .where(Review.clinic_id == clinic.id, Review.verified.is_(True))
        .order_by(Review.created_at.desc())
        .limit(limit)
        .offset(offset)
    )).all()

    total_count = (await db.execute(
        select(func.count()).where(
            Review.clinic_id == clinic.id, Review.verified.is_(True)
        )
    )).scalar_one()

    avg = (await db.execute(
        select(func.avg(Review.rating)).where(
            Review.clinic_id == clinic.id, Review.verified.is_(True)
        )
    )).scalar_one()

    reviews = [
        ReviewOut(
            id=str(r.id),
            rating=r.rating,
            review_text=r.review_text,
            reviewer_location=r.reviewer_location,
            retreat_id=str(r.retreat_id) if r.retreat_id else None,
            retreat_name=(retreat.name_display_en or retreat.name) if retreat else None,
            verified=r.verified,
            created_at=r.created_at,
        )
        for r, retreat in rows
    ]

    return ReviewListOut(
        total=total_count,
        avg_rating=round(float(avg), 1) if avg else None,
        reviews=reviews,
    )


# ── GET /api/retreats/{id}/reviews ───────────────────────────────────────────

@router.get("/api/retreats/{retreat_id}/reviews", response_model=ReviewListOut)
async def get_retreat_reviews(
    retreat_id: str,
    db: AsyncSession = Depends(get_db),
) -> ReviewListOut:
    try:
        rid = uuid.UUID(retreat_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid retreat ID")

    retreat_row = await db.execute(
        select(Retreat).where(Retreat.id == rid, Retreat.is_active.is_(True))
    )
    if retreat_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Retreat not found")

    rows = (await db.execute(
        select(Review)
        .where(Review.retreat_id == rid, Review.verified.is_(True))
        .order_by(Review.created_at.desc())
    )).scalars().all()

    avg = (await db.execute(
        select(func.avg(Review.rating)).where(
            Review.retreat_id == rid, Review.verified.is_(True)
        )
    )).scalar_one()

    reviews = [
        ReviewOut(
            id=str(r.id),
            rating=r.rating,
            review_text=r.review_text,
            reviewer_location=r.reviewer_location,
            retreat_id=str(r.retreat_id) if r.retreat_id else None,
            retreat_name=None,
            verified=r.verified,
            created_at=r.created_at,
        )
        for r in rows
    ]

    return ReviewListOut(
        total=len(reviews),
        avg_rating=round(float(avg), 1) if avg else None,
        reviews=reviews,
    )


# ── POST /api/reviews ─────────────────────────────────────────────────────────

@router.post("/api/reviews", response_model=ReviewOut, status_code=201)
async def submit_review(
    body: ReviewSubmit,
    db: AsyncSession = Depends(get_db),
) -> ReviewOut:
    # Validate booking_id
    try:
        bid = uuid.UUID(body.booking_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid booking ID")

    # Look up booking and verify email
    booking_row = await db.execute(
        select(Booking).where(Booking.id == bid)
    )
    booking = booking_row.scalar_one_or_none()
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.guest_email.lower() != body.guest_email.lower():
        raise HTTPException(status_code=403, detail="Email does not match booking")
    if booking.status not in ("confirmed", "completed"):
        raise HTTPException(status_code=400, detail="Review only allowed for confirmed or completed bookings")

    # Check duplicate
    existing = (await db.execute(
        select(Review).where(Review.booking_id == bid)
    )).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="A review for this booking already exists")

    # Resolve retreat name for response
    retreat_name: str | None = None
    if booking.retreat_id:
        retreat_row = await db.execute(select(Retreat).where(Retreat.id == booking.retreat_id))
        rt = retreat_row.scalar_one_or_none()
        if rt:
            retreat_name = rt.name_display_en or rt.name

    review = Review(
        patient_pseudo_id=f"guest_{str(bid)[:8]}",
        clinic_id=booking.clinic_id,
        booking_id=booking.id,
        retreat_id=booking.retreat_id,
        rating=body.rating,
        review_text=body.review_text,
        reviewer_location=body.reviewer_location,
        verified=False,  # requires admin moderation before going live
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)

    return ReviewOut(
        id=str(review.id),
        rating=review.rating,
        review_text=review.review_text,
        reviewer_location=review.reviewer_location,
        retreat_id=str(review.retreat_id) if review.retreat_id else None,
        retreat_name=retreat_name,
        verified=review.verified,
        created_at=review.created_at,
    )
