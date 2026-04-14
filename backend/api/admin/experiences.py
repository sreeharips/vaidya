"""
api/admin/experiences.py — Clinic admin management of clinic_experiences (paid add-ons).

GET    /api/admin/experiences           — list clinic's experiences
POST   /api/admin/experiences           — create
PATCH  /api/admin/experiences/{id}      — update
DELETE /api/admin/experiences/{id}      — soft delete (is_active=False)
POST   /api/admin/experiences/reorder   — set display_order by ID list
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic
from db.database import get_db
from db.models import ClinicExperience, ClinicFeatureStore

router = APIRouter()

EXPERIENCE_CATEGORIES = ("sightseeing", "adventure", "cultural", "nature", "wellness")


# ── Schemas ───────────────────────────────────────────────────────────────────

class ClinicExperienceOut(BaseModel):
    id: str
    name_en: str
    name_ar: str | None
    name_ml: str | None
    description_en: str | None
    description_ar: str | None
    description_ml: str | None
    category: str
    price_inr: float
    photos: list[str]
    max_per_booking: int
    is_active: bool
    display_order: int


class ClinicExperienceCreate(BaseModel):
    name_en: str
    name_ar: str | None = None
    name_ml: str | None = None
    description_en: str | None = None
    description_ar: str | None = None
    description_ml: str | None = None
    category: str = "sightseeing"
    price_inr: float = Field(gt=0)
    photos: list[str] = []
    max_per_booking: int = Field(default=1, ge=1)
    is_active: bool = True
    display_order: int = 0

    def validate_category(self) -> None:
        if self.category not in EXPERIENCE_CATEGORIES:
            raise HTTPException(status_code=422, detail=f"category must be one of {EXPERIENCE_CATEGORIES}")


class ClinicExperienceUpdate(BaseModel):
    name_en: str | None = None
    name_ar: str | None = None
    name_ml: str | None = None
    description_en: str | None = None
    description_ar: str | None = None
    description_ml: str | None = None
    category: str | None = None
    price_inr: float | None = Field(default=None, gt=0)
    photos: list[str] | None = None
    max_per_booking: int | None = Field(default=None, ge=1)
    is_active: bool | None = None
    display_order: int | None = None


class ReorderRequest(BaseModel):
    ids: list[str]


def _exp_out(exp: ClinicExperience) -> ClinicExperienceOut:
    return ClinicExperienceOut(
        id=str(exp.id),
        name_en=exp.name_en,
        name_ar=exp.name_ar,
        name_ml=exp.name_ml,
        description_en=exp.description_en,
        description_ar=exp.description_ar,
        description_ml=exp.description_ml,
        category=exp.category,
        price_inr=float(exp.price_inr),
        photos=exp.photos or [],
        max_per_booking=exp.max_per_booking,
        is_active=exp.is_active,
        display_order=exp.display_order,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/experiences", response_model=list[ClinicExperienceOut])
async def list_experiences(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
) -> list[ClinicExperienceOut]:
    result = await db.execute(
        select(ClinicExperience)
        .where(ClinicExperience.clinic_id == clinic.id)
        .order_by(ClinicExperience.display_order, ClinicExperience.created_at)
    )
    return [_exp_out(e) for e in result.scalars().all()]


@router.post("/experiences", response_model=ClinicExperienceOut, status_code=201)
async def create_experience(
    body: ClinicExperienceCreate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
) -> ClinicExperienceOut:
    body.validate_category()
    exp = ClinicExperience(
        clinic_id=clinic.id,
        name_en=body.name_en,
        name_ar=body.name_ar,
        name_ml=body.name_ml,
        description_en=body.description_en,
        description_ar=body.description_ar,
        description_ml=body.description_ml,
        category=body.category,
        price_inr=body.price_inr,
        photos=body.photos,
        max_per_booking=body.max_per_booking,
        is_active=body.is_active,
        display_order=body.display_order,
    )
    db.add(exp)
    await db.flush()
    await db.refresh(exp)
    return _exp_out(exp)


@router.patch("/experiences/{exp_id}", response_model=ClinicExperienceOut)
async def update_experience(
    exp_id: str,
    body: ClinicExperienceUpdate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
) -> ClinicExperienceOut:
    try:
        eid = uuid.UUID(exp_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid experience ID")

    result = await db.execute(
        select(ClinicExperience).where(
            ClinicExperience.id == eid,
            ClinicExperience.clinic_id == clinic.id,
        )
    )
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


@router.delete("/experiences/{exp_id}", status_code=204)
async def delete_experience(
    exp_id: str,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
) -> None:
    try:
        eid = uuid.UUID(exp_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid experience ID")

    result = await db.execute(
        select(ClinicExperience).where(
            ClinicExperience.id == eid,
            ClinicExperience.clinic_id == clinic.id,
        )
    )
    exp = result.scalar_one_or_none()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experience not found")

    exp.is_active = False
    await db.flush()


@router.post("/experiences/reorder", status_code=204)
async def reorder_experiences(
    body: ReorderRequest,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
) -> None:
    for order, exp_id_str in enumerate(body.ids):
        try:
            eid = uuid.UUID(exp_id_str)
        except ValueError:
            continue
        result = await db.execute(
            select(ClinicExperience).where(
                ClinicExperience.id == eid,
                ClinicExperience.clinic_id == clinic.id,
            )
        )
        exp = result.scalar_one_or_none()
        if exp is not None:
            exp.display_order = order
    await db.flush()
