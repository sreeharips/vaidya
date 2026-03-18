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
from db.models import ClinicFeatureStore

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
    prakriti_affinities: list[str]
    certifications: list[str]
    pricing_min: float | None
    pricing_max: float | None
    accommodation_available: bool
    pickup_available: bool
    pickup_locations: list[str]
    ecommerce_enabled: bool
    outcome_enrolled: bool
    operating_hours: dict | None
    social_links: dict | None
    shipping_policy: str | None
    return_policy: str | None
    rating: float | None
    review_count: int
    is_active: bool


class ClinicUpdate(BaseModel):
    name: str | None = None
    description_en: str | None = None
    description_ml: str | None = None
    description_ar: str | None = None
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
    prakriti_affinities: list[str] | None = None
    pricing_min: float | None = None
    pricing_max: float | None = None
    certifications: list[str] | None = None
    accommodation_available: bool | None = None
    pickup_available: bool | None = None
    pickup_locations: list[str] | None = None
    ecommerce_enabled: bool | None = None
    outcome_enrolled: bool | None = None
    operating_hours: dict | None = None
    social_links: dict | None = None
    shipping_policy: str | None = None
    return_policy: str | None = None


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
        prakriti_affinities=c.prakriti_affinities or [],
        certifications=c.certifications or [],
        pricing_min=float(c.pricing_min) if c.pricing_min else None,
        pricing_max=float(c.pricing_max) if c.pricing_max else None,
        accommodation_available=c.accommodation_available,
        pickup_available=c.pickup_available,
        pickup_locations=c.pickup_locations or [],
        ecommerce_enabled=c.ecommerce_enabled,
        outcome_enrolled=c.outcome_enrolled,
        operating_hours=c.operating_hours,
        social_links=c.social_links,
        shipping_policy=c.shipping_policy,
        return_policy=c.return_policy,
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
