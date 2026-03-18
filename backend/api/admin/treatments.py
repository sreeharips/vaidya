"""
api/admin/treatments.py — Treatment management for clinic admins.

GET    /api/admin/treatments
POST   /api/admin/treatments
PATCH  /api/admin/treatments/{id}
DELETE /api/admin/treatments/{id}
POST   /api/admin/treatments/{id}/link-doctors
"""

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic
from db.database import get_db
from db.models import Booking, ClinicFeatureStore, Doctor, DoctorTreatment, Treatment

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────────────────────

class TreatmentOut(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None
    prakriti_tags: list[str]
    duration_min_days: int | None
    duration_max_days: int | None
    price_per_day: float | None
    included_therapies: list[str]
    is_active: bool
    doctor_ids: list[str]


class TreatmentCreate(BaseModel):
    name: str
    name_display_en: str | None = None
    name_display_ml: str | None = None
    name_display_ar: str | None = None
    description_en: str | None = None
    description_ml: str | None = None
    treatment_type: str = "therapy"
    duration_min_days: int | None = None
    duration_max_days: int | None = None
    price_per_day_usd: float | None = None
    price_total_usd: float | None = None
    currency: str = "USD"
    inr_price: float | None = None
    prakriti_tags: list[str] = []
    conditions_treated: list[str] = []
    doctor_ids: list[str] = []
    includes_accommodation: bool = False
    includes_medicines: bool = False
    contraindications_en: str | None = None
    is_active: bool = True
    display_order: int = 0


class TreatmentUpdate(BaseModel):
    name: str | None = None
    name_display_en: str | None = None
    name_display_ml: str | None = None
    name_display_ar: str | None = None
    description_en: str | None = None
    description_ml: str | None = None
    treatment_type: str | None = None
    duration_min_days: int | None = None
    duration_max_days: int | None = None
    price_per_day_usd: float | None = None
    prakriti_tags: list[str] | None = None
    conditions_treated: list[str] | None = None
    is_active: bool | None = None
    display_order: int | None = None


class LinkDoctorsBody(BaseModel):
    doctor_ids: list[str]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_treatment_slug(name: str) -> str:
    slug = name.lower().replace(" ", "-")
    slug = re.sub(r"[^a-z0-9-]", "", slug)
    return re.sub(r"-+", "-", slug).strip("-")


async def _get_doctor_ids(treatment_id: uuid.UUID, db: AsyncSession) -> list[str]:
    result = await db.execute(
        select(DoctorTreatment.doctor_id).where(DoctorTreatment.treatment_id == treatment_id)
    )
    return [str(row[0]) for row in result.all()]


def _treatment_to_out(t: Treatment, doctor_ids: list[str]) -> TreatmentOut:
    return TreatmentOut(
        id=str(t.id),
        name=t.name,
        slug=t.slug,
        description=t.description,
        prakriti_tags=t.prakriti_tags or [],
        duration_min_days=t.duration_min_days,
        duration_max_days=t.duration_max_days,
        price_per_day=float(t.price_per_day) if t.price_per_day else None,
        included_therapies=t.included_therapies or [],
        is_active=t.is_active,
        doctor_ids=doctor_ids,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/treatments", response_model=list[TreatmentOut])
async def list_treatments(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Treatment).where(Treatment.clinic_id == clinic.id).order_by(Treatment.name)
    )
    treatments = result.scalars().all()
    out = []
    for t in treatments:
        dids = await _get_doctor_ids(t.id, db)
        out.append(_treatment_to_out(t, dids))
    return out


@router.post("/treatments", response_model=TreatmentOut, status_code=201)
async def create_treatment(
    body: TreatmentCreate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    slug = _make_treatment_slug(body.name)
    existing = (await db.execute(select(Treatment).where(Treatment.slug == slug))).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    treatment = Treatment(
        name=body.name,
        slug=slug,
        description=body.description_en,
        prakriti_tags=body.prakriti_tags,
        duration_min_days=body.duration_min_days,
        duration_max_days=body.duration_max_days,
        price_per_day=body.price_per_day_usd,
        included_therapies=body.conditions_treated,
        clinic_id=clinic.id,
        is_active=body.is_active,
    )
    db.add(treatment)
    await db.flush()

    # Link doctors
    for did in body.doctor_ids:
        doctor = await db.get(Doctor, uuid.UUID(did))
        if doctor and doctor.clinic_id == clinic.id:
            db.add(DoctorTreatment(doctor_id=doctor.id, treatment_id=treatment.id))

    await db.commit()
    await db.refresh(treatment)
    dids = await _get_doctor_ids(treatment.id, db)
    return _treatment_to_out(treatment, dids)


@router.patch("/treatments/{treatment_id}", response_model=TreatmentOut)
async def update_treatment(
    treatment_id: str,
    body: TreatmentUpdate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    treatment = await db.get(Treatment, uuid.UUID(treatment_id))
    if not treatment or treatment.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Treatment not found")

    update_data = body.model_dump(exclude_unset=True)
    field_map = {
        "description_en": "description",
        "price_per_day_usd": "price_per_day",
    }
    for field, value in update_data.items():
        attr = field_map.get(field, field)
        if hasattr(treatment, attr):
            setattr(treatment, attr, value)

    await db.commit()
    await db.refresh(treatment)
    dids = await _get_doctor_ids(treatment.id, db)
    return _treatment_to_out(treatment, dids)


@router.delete("/treatments/{treatment_id}")
async def delete_treatment(
    treatment_id: str,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    treatment = await db.get(Treatment, uuid.UUID(treatment_id))
    if not treatment or treatment.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Treatment not found")

    from datetime import date as _date

    future_bookings = (await db.execute(
        select(Booking).where(
            Booking.treatment_id == treatment.id,
            Booking.status.in_(["pending", "confirmed"]),
            Booking.start_date >= _date.today(),
        )
    )).scalars().all()

    if future_bookings:
        dates = [str(b.start_date) for b in future_bookings]
        raise HTTPException(
            status_code=409,
            detail={"message": "Cannot deactivate: treatment has future bookings", "affected_dates": dates},
        )

    treatment.is_active = False
    await db.commit()
    return {"id": treatment_id, "is_active": False}


@router.post("/treatments/{treatment_id}/link-doctors")
async def link_doctors(
    treatment_id: str,
    body: LinkDoctorsBody,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    treatment = await db.get(Treatment, uuid.UUID(treatment_id))
    if not treatment or treatment.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Treatment not found")

    # Remove existing links
    existing = (await db.execute(
        select(DoctorTreatment).where(DoctorTreatment.treatment_id == treatment.id)
    )).scalars().all()
    for dt in existing:
        await db.delete(dt)

    # Add new links
    linked = []
    for did in body.doctor_ids:
        doctor = await db.get(Doctor, uuid.UUID(did))
        if doctor and doctor.clinic_id == clinic.id:
            db.add(DoctorTreatment(doctor_id=doctor.id, treatment_id=treatment.id))
            linked.append(did)

    await db.commit()
    return {"treatment_id": treatment_id, "linked_doctor_ids": linked}
