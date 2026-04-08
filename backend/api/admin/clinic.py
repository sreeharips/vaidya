"""
api/admin/clinic.py — Clinic profile management.

GET    /api/admin/clinic       — full clinic profile
PATCH  /api/admin/clinic       — update clinic fields
DELETE /api/admin/clinic       — soft delete (requires platform_admin confirmation)
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic
from db.database import get_db
from sqlalchemy import select

from db.models import ClinicFeatureStore, Review

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────────────────────

class ClinicProfileOut(BaseModel):
    id: str
    slug: str
    name: str
    tier: int
    description_en: str | None
    description_ml: str | None
    description_ar: str | None
    district: str | None
    address: str | None
    address_line1: str | None
    address_line2: str | None
    state: str | None
    pincode: str | None
    lat: float | None
    lng: float | None
    phone: str | None
    email: str | None
    website_url: str | None
    languages: list[str]
    specialisations: list[str]
    wellness_categories: list[str]
    certifications: list[str]
    atmosphere: list[str]
    pricing_min: float | None
    pricing_max: float | None
    accommodation_available: bool
    pickup_available: bool
    pickup_locations: list[str]
    outcome_enrolled: bool
    operating_hours: dict | None
    social_links: dict | None
    transport_info: str | None
    established_year: int | None
    highlights: list[str]
    accommodation_types: list[str]
    meal_options: list[str]
    nearest_airport: str | None
    nearest_railway: str | None
    patient_capacity: int | None
    rating: float | None
    review_count: int
    is_active: bool


class ClinicUpdate(BaseModel):
    name: str | None = None
    description_en: str | None = None
    description_ml: str | None = None
    description_ar: str | None = None
    address: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    district: str | None = None
    state: str | None = None
    pincode: str | None = None
    lat: float | None = None
    lng: float | None = None
    phone: str | None = None
    email: str | None = None
    website_url: str | None = None
    languages: list[str] | None = None
    specialisations: list[str] | None = None
    wellness_categories: list[str] | None = None
    atmosphere: list[str] | None = None
    pricing_min: float | None = None
    pricing_max: float | None = None
    certifications: list[str] | None = None
    accommodation_available: bool | None = None
    pickup_available: bool | None = None
    pickup_locations: list[str] | None = None
    transport_info: str | None = None
    outcome_enrolled: bool | None = None
    operating_hours: dict | None = None
    social_links: dict | None = None
    established_year: int | None = None
    highlights: list[str] | None = None
    accommodation_types: list[str] | None = None
    meal_options: list[str] | None = None
    nearest_airport: str | None = None
    nearest_railway: str | None = None
    patient_capacity: int | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clinic_to_out(c: ClinicFeatureStore) -> ClinicProfileOut:
    return ClinicProfileOut(
        id=str(c.id),
        slug=c.slug,
        name=c.name,
        tier=c.tier,
        description_en=c.description_en,
        description_ml=c.description_ml,
        description_ar=c.description_ar,
        district=c.district,
        address=c.address,
        address_line1=c.address_line1,
        address_line2=c.address_line2,
        state=c.state,
        pincode=c.pincode,
        lat=c.lat,
        lng=c.lng,
        phone=c.phone,
        email=c.email,
        website_url=c.website_url,
        languages=c.languages or [],
        specialisations=c.specialisations or [],
        wellness_categories=c.wellness_categories or [],
        certifications=c.certifications or [],
        atmosphere=c.atmosphere or [],
        pricing_min=float(c.pricing_min) if c.pricing_min else None,
        pricing_max=float(c.pricing_max) if c.pricing_max else None,
        accommodation_available=c.accommodation_available,
        pickup_available=c.pickup_available,
        pickup_locations=c.pickup_locations or [],
        transport_info=c.transport_info,
        outcome_enrolled=c.outcome_enrolled,
        operating_hours=c.operating_hours,
        social_links=c.social_links,
        established_year=c.established_year,
        highlights=c.highlights or [],
        accommodation_types=c.accommodation_types or [],
        meal_options=c.meal_options or [],
        nearest_airport=c.nearest_airport,
        nearest_railway=c.nearest_railway,
        patient_capacity=c.patient_capacity,
        rating=c.rating,
        review_count=c.review_count,
        is_active=c.is_active,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/clinic", response_model=ClinicProfileOut)
async def get_clinic(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
):
    return _clinic_to_out(clinic)


@router.patch("/clinic", response_model=ClinicProfileOut)
async def update_clinic(
    body: ClinicUpdate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(clinic, field, value)
    clinic.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(clinic)
    return _clinic_to_out(clinic)


@router.get("/clinic/reviews")
async def get_clinic_reviews(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    """
    Return reviews for this clinic — admin read-only view.
    Includes unverified reviews (staff can see all, unlike the public page).
    """
    rows = (await db.execute(
        select(Review)
        .where(Review.clinic_id == clinic.id)
        .order_by(Review.created_at.desc())
        .limit(limit)
    )).scalars().all()

    return {
        "total": len(rows),
        "avg_rating": round(sum(r.rating for r in rows) / len(rows), 1) if rows else None,
        "reviews": [
            {
                "id": str(r.id),
                "rating": r.rating,
                "review_text": r.review_text,
                "reviewer_location": r.reviewer_location,
                "treatment_slug": r.treatment_slug,
                "verified": r.verified,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
    }


@router.delete("/clinic")
async def delete_clinic(
    confirmation_token: str | None = None,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete — set is_active=false. Requires confirmation."""
    if confirmation_token != "CONFIRM_DEACTIVATE":
        raise HTTPException(
            status_code=400,
            detail="Pass confirmation_token='CONFIRM_DEACTIVATE' to deactivate.",
        )
    clinic.is_active = False
    clinic.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": str(clinic.id), "is_active": False, "detail": "Clinic deactivated"}
