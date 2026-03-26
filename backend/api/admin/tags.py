"""
api/admin/tags.py — Wellness category and specialisation tag management.

GET    /api/admin/tags/wellness-categories    — master list of wellness categories
GET    /api/admin/tags/specialisations        — master list of specialisations
PATCH  /api/admin/tags/clinic-specialisations — update clinic specialisations
PATCH  /api/admin/tags/clinic-wellness-categories — update clinic wellness categories
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic
from db.database import get_db
from db.models import ClinicFeatureStore

router = APIRouter()

# Master wellness category list — plain-language, no Sanskrit jargon
WELLNESS_CATEGORIES = [
    {"slug": "detox-cleanse", "name_en": "Detox & Cleanse", "name_ml": "ഡീറ്റോക്സ് & ക്ലെൻസ്"},
    {"slug": "stress-relief", "name_en": "Stress Relief", "name_ml": "സമ്മർദ്ദ ശമനം"},
    {"slug": "pain-management", "name_en": "Pain Management", "name_ml": "വേദന നിയന്ത്രണം"},
    {"slug": "weight-wellness", "name_en": "Weight & Wellness", "name_ml": "ഭാരം & ആരോഗ്യം"},
    {"slug": "skin-hair", "name_en": "Skin & Hair Care", "name_ml": "ത്വക് & മുടി പരിചരണം"},
    {"slug": "immunity-boost", "name_en": "Immunity Boost", "name_ml": "രോഗപ്രതിരോധ വർധന"},
    {"slug": "fertility-wellness", "name_en": "Fertility & Women's Health", "name_ml": "പ്രത്യുത്പാദന ആരോഗ്യം"},
    {"slug": "anti-aging", "name_en": "Anti-Aging & Rejuvenation", "name_ml": "യൗവന സംരക്ഷണം"},
    {"slug": "digestive-health", "name_en": "Digestive Health", "name_ml": "ദഹന ആരോഗ്യം"},
    {"slug": "mental-clarity", "name_en": "Mental Clarity & Focus", "name_ml": "മാനസിക ശുദ്ധി"},
    {"slug": "joint-mobility", "name_en": "Joint & Mobility", "name_ml": "സന്ധി & ചലനക്ഷമത"},
    {"slug": "post-surgery", "name_en": "Post-Surgery Recovery", "name_ml": "ശസ്ത്രക്രിയാനന്തര വീണ്ടെടുപ്പ്"},
]

# Master specialisation list (treatment-level)
SPECIALISATIONS = [
    {"slug": "panchakarma", "name_en": "Panchakarma"},
    {"slug": "shirodhara", "name_en": "Shirodhara"},
    {"slug": "abhyanga", "name_en": "Abhyanga"},
    {"slug": "pizhichil", "name_en": "Pizhichil"},
    {"slug": "njavara-kizhi", "name_en": "Njavara Kizhi"},
    {"slug": "nasya", "name_en": "Nasya"},
    {"slug": "virechana", "name_en": "Virechana"},
    {"slug": "basti", "name_en": "Basti"},
    {"slug": "udvartana", "name_en": "Udvartana"},
    {"slug": "rasayana", "name_en": "Rasayana"},
    {"slug": "kati-basti", "name_en": "Kati Basti"},
    {"slug": "janu-basti", "name_en": "Janu Basti"},
    {"slug": "takradhara", "name_en": "Takradhara"},
    {"slug": "lepa", "name_en": "Lepa"},
    {"slug": "yoga-therapy", "name_en": "Yoga Therapy"},
    {"slug": "diet-counselling", "name_en": "Diet Counselling"},
]


# ── Pydantic models ──────────────────────────────────────────────────────────

class WellnessCategoryOut(BaseModel):
    slug: str
    name_en: str
    name_ml: str | None = None


class SpecialisationOut(BaseModel):
    slug: str
    name_en: str


class UpdateWellnessCategories(BaseModel):
    categories: list[str]


class UpdateSpecialisations(BaseModel):
    specialisations: list[str]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/tags/wellness-categories", response_model=list[WellnessCategoryOut])
async def list_wellness_categories():
    return [WellnessCategoryOut(**c) for c in WELLNESS_CATEGORIES]


@router.get("/tags/specialisations", response_model=list[SpecialisationOut])
async def list_specialisations():
    return [SpecialisationOut(**s) for s in SPECIALISATIONS]


@router.patch("/tags/clinic-wellness-categories")
async def update_clinic_wellness_categories(
    body: UpdateWellnessCategories,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    clinic.wellness_categories = body.categories
    clinic.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"wellness_categories": clinic.wellness_categories}


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
