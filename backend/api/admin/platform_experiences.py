"""
api/admin/platform_experiences.py — Platform admin management of curated experiences.

GET    /api/admin/platform/experiences        — list all
POST   /api/admin/platform/experiences        — create
GET    /api/admin/platform/experiences/{id}   — get one
PATCH  /api/admin/platform/experiences/{id}   — update
DELETE /api/admin/platform/experiences/{id}   — soft delete
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import require_platform_admin
from db.database import get_db
from db.models import Experience

router = APIRouter()

EXPERIENCE_CATEGORIES = ("sightseeing", "adventure", "cultural", "nature", "wellness")


# ── Schemas ───────────────────────────────────────────────────────────────────

class PlatformExperienceOut(BaseModel):
    id: str
    name_en: str
    name_ar: str | None
    name_ml: str | None
    description_en: str | None
    description_ar: str | None
    description_ml: str | None
    category: str
    lat: float | None
    lng: float | None
    district: str | None
    region_label: str | None
    typical_duration_hours: float | None
    price_inr: float
    is_free: bool
    photos: list[str]
    external_url: str | None
    is_active: bool


class PlatformExperienceCreate(BaseModel):
    name_en: str
    name_ar: str | None = None
    name_ml: str | None = None
    description_en: str | None = None
    description_ar: str | None = None
    description_ml: str | None = None
    category: str = "sightseeing"
    lat: float | None = None
    lng: float | None = None
    district: str | None = None
    region_label: str | None = None
    typical_duration_hours: float | None = None
    price_inr: float = Field(default=0, ge=0)
    is_free: bool = True
    photos: list[str] = []
    external_url: str | None = None
    is_active: bool = True


class PlatformExperienceUpdate(BaseModel):
    name_en: str | None = None
    name_ar: str | None = None
    name_ml: str | None = None
    description_en: str | None = None
    description_ar: str | None = None
    description_ml: str | None = None
    category: str | None = None
    lat: float | None = None
    lng: float | None = None
    district: str | None = None
    region_label: str | None = None
    typical_duration_hours: float | None = None
    price_inr: float | None = Field(default=None, ge=0)
    is_free: bool | None = None
    photos: list[str] | None = None
    external_url: str | None = None
    is_active: bool | None = None


def _exp_out(exp: Experience) -> PlatformExperienceOut:
    return PlatformExperienceOut(
        id=str(exp.id),
        name_en=exp.name_en,
        name_ar=exp.name_ar,
        name_ml=exp.name_ml,
        description_en=exp.description_en,
        description_ar=exp.description_ar,
        description_ml=exp.description_ml,
        category=exp.category,
        lat=exp.lat,
        lng=exp.lng,
        district=exp.district,
        region_label=exp.region_label,
        typical_duration_hours=exp.typical_duration_hours,
        price_inr=float(exp.price_inr),
        is_free=exp.is_free,
        photos=exp.photos or [],
        external_url=exp.external_url,
        is_active=exp.is_active,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/platform/experiences", response_model=list[PlatformExperienceOut])
async def list_platform_experiences(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_platform_admin),
) -> list[PlatformExperienceOut]:
    result = await db.execute(
        select(Experience).order_by(Experience.category, Experience.name_en)
    )
    return [_exp_out(e) for e in result.scalars().all()]


@router.post("/platform/experiences", response_model=PlatformExperienceOut, status_code=201)
async def create_platform_experience(
    body: PlatformExperienceCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_platform_admin),
) -> PlatformExperienceOut:
    if body.category not in EXPERIENCE_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"category must be one of {EXPERIENCE_CATEGORIES}")

    exp = Experience(
        name_en=body.name_en,
        name_ar=body.name_ar,
        name_ml=body.name_ml,
        description_en=body.description_en,
        description_ar=body.description_ar,
        description_ml=body.description_ml,
        category=body.category,
        lat=body.lat,
        lng=body.lng,
        district=body.district,
        region_label=body.region_label,
        typical_duration_hours=body.typical_duration_hours,
        price_inr=body.price_inr,
        is_free=body.is_free,
        photos=body.photos,
        external_url=body.external_url,
        is_active=body.is_active,
    )
    db.add(exp)
    await db.flush()
    await db.refresh(exp)
    return _exp_out(exp)


@router.get("/platform/experiences/{exp_id}", response_model=PlatformExperienceOut)
async def get_platform_experience(
    exp_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_platform_admin),
) -> PlatformExperienceOut:
    try:
        eid = uuid.UUID(exp_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid experience ID")

    result = await db.execute(select(Experience).where(Experience.id == eid))
    exp = result.scalar_one_or_none()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experience not found")
    return _exp_out(exp)


@router.patch("/platform/experiences/{exp_id}", response_model=PlatformExperienceOut)
async def update_platform_experience(
    exp_id: str,
    body: PlatformExperienceUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_platform_admin),
) -> PlatformExperienceOut:
    try:
        eid = uuid.UUID(exp_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid experience ID")

    result = await db.execute(select(Experience).where(Experience.id == eid))
    exp = result.scalar_one_or_none()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experience not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "category" and value not in EXPERIENCE_CATEGORIES:
            raise HTTPException(status_code=422, detail=f"category must be one of {EXPERIENCE_CATEGORIES}")
        setattr(exp, field, value)

    await db.flush()
    await db.refresh(exp)
    return _exp_out(exp)


@router.delete("/platform/experiences/{exp_id}", status_code=204)
async def delete_platform_experience(
    exp_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_platform_admin),
) -> None:
    try:
        eid = uuid.UUID(exp_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid experience ID")

    result = await db.execute(select(Experience).where(Experience.id == eid))
    exp = result.scalar_one_or_none()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experience not found")

    exp.is_active = False
    await db.flush()
