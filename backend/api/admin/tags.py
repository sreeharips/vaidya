"""
api/admin/tags.py — Specialisation and condition tag management.

GET    /api/admin/tags/specialisations
GET    /api/admin/tags/conditions
PATCH  /api/admin/tags/clinic-specialisations
PATCH  /api/admin/tags/clinic-conditions
PATCH  /api/admin/tags/doctor-specialisations/{doctor_id}
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic
from db.database import get_db
from db.models import ClinicFeatureStore, ConditionMap, Doctor

router = APIRouter()

# Master specialisation list (seeded from config / curated by platform)
SPECIALISATIONS = [
    {"slug": "panchakarma", "name_en": "Panchakarma", "name_ml": "പഞ്ചകര്‍മ"},
    {"slug": "shirodhara", "name_en": "Shirodhara", "name_ml": "ശിരോധാര"},
    {"slug": "abhyanga", "name_en": "Abhyanga", "name_ml": "അഭ്യംഗ"},
    {"slug": "pizhichil", "name_en": "Pizhichil", "name_ml": "പിഴിച്ചിൽ"},
    {"slug": "njavara-kizhi", "name_en": "Njavara Kizhi", "name_ml": "നവര കിഴി"},
    {"slug": "nasya", "name_en": "Nasya", "name_ml": "നസ്യ"},
    {"slug": "virechana", "name_en": "Virechana", "name_ml": "വിരേചന"},
    {"slug": "basti", "name_en": "Basti", "name_ml": "ബസ്തി"},
    {"slug": "udvartana", "name_en": "Udvartana", "name_ml": "ഉദ്വർത്തന"},
    {"slug": "rasayana", "name_en": "Rasayana", "name_ml": "രസായന"},
    {"slug": "kati-basti", "name_en": "Kati Basti", "name_ml": "കടി ബസ്തി"},
    {"slug": "janu-basti", "name_en": "Janu Basti", "name_ml": "ജാനു ബസ്തി"},
    {"slug": "takradhara", "name_en": "Takradhara", "name_ml": "തക്രധാര"},
    {"slug": "lepa", "name_en": "Lepa", "name_ml": "ലേപ"},
    {"slug": "yoga-therapy", "name_en": "Yoga Therapy", "name_ml": "യോഗ ചികിത്സ"},
    {"slug": "diet-counselling", "name_en": "Diet Counselling", "name_ml": "ആഹാര ഉപദേശം"},
    {"slug": "fertility", "name_en": "Fertility Treatment", "name_ml": "വന്ധ്യത ചികിത്സ"},
    {"slug": "stress-management", "name_en": "Stress Management", "name_ml": "സമ്മർദ്ദ നിയന്ത്രണം"},
    {"slug": "skin-care", "name_en": "Skin Care", "name_ml": "ത്വക് പരിചരണം"},
    {"slug": "weight-management", "name_en": "Weight Management", "name_ml": "ഭാരം നിയന്ത്രണം"},
]


# ── Pydantic models ──────────────────────────────────────────────────────────

class SpecialisationOut(BaseModel):
    slug: str
    name_en: str
    name_ml: str | None = None


class ConditionOut(BaseModel):
    id: str
    condition_slug: str
    condition_name: str
    condition_name_ar: str | None
    condition_name_ml: str | None


class UpdateSpecialisations(BaseModel):
    specialisations: list[str]


class UpdateConditions(BaseModel):
    condition_slugs: list[str]


class UpdateDoctorTags(BaseModel):
    specialisations: list[str]
    prakriti_affinities: list[str]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/tags/specialisations", response_model=list[SpecialisationOut])
async def list_specialisations():
    return [SpecialisationOut(**s) for s in SPECIALISATIONS]


@router.get("/tags/conditions", response_model=list[ConditionOut])
async def list_conditions(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ConditionMap).order_by(ConditionMap.condition_name)
    )
    return [
        ConditionOut(
            id=str(c.id),
            condition_slug=c.condition_slug,
            condition_name=c.condition_name,
            condition_name_ar=c.condition_name_ar,
            condition_name_ml=c.condition_name_ml,
        )
        for c in result.scalars().all()
    ]


@router.patch("/tags/clinic-specialisations")
async def update_clinic_specialisations(
    body: UpdateSpecialisations,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    clinic.specialisations = body.specialisations
    clinic.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"specialisations": clinic.specialisations}


@router.patch("/tags/clinic-conditions")
async def update_clinic_conditions(
    body: UpdateConditions,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    # Conditions are stored as part of specialisations or as separate metadata
    # For now, store as a JSON field or extend the model
    # Using included_therapies on the clinic is one approach, but let's store it simply
    clinic.specialisations = list(set((clinic.specialisations or []) + body.condition_slugs))
    clinic.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"condition_slugs": body.condition_slugs}


@router.patch("/tags/doctor-specialisations/{doctor_id}")
async def update_doctor_tags(
    doctor_id: str,
    body: UpdateDoctorTags,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    doctor = await db.get(Doctor, uuid.UUID(doctor_id))
    if not doctor or doctor.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Doctor not found")

    doctor.specialisations = body.specialisations
    doctor.prakriti_affinities = body.prakriti_affinities
    doctor.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "doctor_id": doctor_id,
        "specialisations": doctor.specialisations,
        "prakriti_affinities": doctor.prakriti_affinities,
    }
