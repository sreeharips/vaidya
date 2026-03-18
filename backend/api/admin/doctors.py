"""
api/admin/doctors.py — Doctor management for clinic admins.

GET    /api/admin/doctors
POST   /api/admin/doctors
PATCH  /api/admin/doctors/{id}
DELETE /api/admin/doctors/{id}
GET    /api/admin/doctors/{id}
POST   /api/admin/doctors/{id}/certifications
"""

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic, require_clinic_admin
from core.storage import upload_pdf_to_s3
from db.database import get_db
from db.models import Booking, ClinicFeatureStore, Doctor, User

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────────────────────

class DoctorOut(BaseModel):
    id: str
    slug: str
    name: str
    name_ml: str | None
    name_ar: str | None
    qualification: str
    years_exp: int
    bio: str | None
    bio_ml: str | None
    bio_ar: str | None
    specialisations: list[str]
    prakriti_affinities: list[str]
    languages: list[str]
    gender: str | None
    consultation_fee_usd: float | None
    photo_url: str | None
    tier: int
    is_active: bool
    rating: float | None
    review_count: int
    doctor_certifications: dict | None


class DoctorCreate(BaseModel):
    full_name: str
    name_ml: str | None = None
    name_ar: str | None = None
    qualification: str = "BAMS"
    years_experience: int = 0
    bio_en: str | None = None
    bio_ml: str | None = None
    bio_ar: str | None = None
    specialisations: list[str] = []
    prakriti_affinities: list[str] = []
    languages_spoken: list[str] = []
    gender: str | None = None
    consultation_fee_usd: float | None = None
    is_active: bool = True
    tier: int = 1


class DoctorUpdate(BaseModel):
    full_name: str | None = None
    name_ml: str | None = None
    name_ar: str | None = None
    qualification: str | None = None
    years_experience: int | None = None
    bio_en: str | None = None
    bio_ml: str | None = None
    bio_ar: str | None = None
    specialisations: list[str] | None = None
    prakriti_affinities: list[str] | None = None
    languages_spoken: list[str] | None = None
    gender: str | None = None
    consultation_fee_usd: float | None = None
    is_active: bool | None = None
    tier: int | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_slug(name: str, district: str | None = None) -> str:
    """Generate a URL-safe slug from a doctor name."""
    parts = [name.lower()]
    if district:
        parts.append(district.lower())
    parts.append("ayurveda")
    slug = "-".join(parts)
    slug = re.sub(r"[^a-z0-9-]", "", slug.replace(" ", "-"))
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def _doctor_to_out(d: Doctor) -> DoctorOut:
    return DoctorOut(
        id=str(d.id),
        slug=d.slug,
        name=d.name,
        name_ml=d.name_ml,
        name_ar=d.name_ar,
        qualification=d.qualification,
        years_exp=d.years_exp,
        bio=d.bio,
        bio_ml=d.bio_ml,
        bio_ar=d.bio_ar,
        specialisations=d.specialisations or [],
        prakriti_affinities=d.prakriti_affinities or [],
        languages=d.languages or [],
        gender=d.gender,
        consultation_fee_usd=float(d.consultation_fee_usd) if d.consultation_fee_usd else None,
        photo_url=d.photo_url,
        tier=d.tier,
        is_active=d.is_active,
        rating=d.rating,
        review_count=d.review_count,
        doctor_certifications=d.doctor_certifications,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/doctors", response_model=list[DoctorOut])
async def list_doctors(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Doctor).where(Doctor.clinic_id == clinic.id).order_by(Doctor.name)
    )
    return [_doctor_to_out(d) for d in result.scalars().all()]


@router.get("/doctors/{doctor_id}", response_model=DoctorOut)
async def get_doctor(
    doctor_id: str,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    doctor = await db.get(Doctor, uuid.UUID(doctor_id))
    if not doctor or doctor.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return _doctor_to_out(doctor)


@router.post("/doctors", response_model=DoctorOut, status_code=201)
async def create_doctor(
    body: DoctorCreate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    slug = _make_slug(body.full_name, clinic.district)

    # Ensure slug is unique
    existing = (await db.execute(select(Doctor).where(Doctor.slug == slug))).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    doctor = Doctor(
        slug=slug,
        name=body.full_name,
        name_ml=body.name_ml,
        name_ar=body.name_ar,
        qualification=body.qualification,
        years_exp=body.years_experience,
        bio=body.bio_en,
        bio_ml=body.bio_ml,
        bio_ar=body.bio_ar,
        specialisations=body.specialisations,
        prakriti_affinities=body.prakriti_affinities,
        languages=body.languages_spoken,
        gender=body.gender,
        consultation_fee_usd=body.consultation_fee_usd,
        clinic_id=clinic.id,
        is_active=body.is_active,
        tier=body.tier,
    )
    db.add(doctor)
    await db.commit()
    await db.refresh(doctor)
    return _doctor_to_out(doctor)


@router.patch("/doctors/{doctor_id}", response_model=DoctorOut)
async def update_doctor(
    doctor_id: str,
    body: DoctorUpdate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    doctor = await db.get(Doctor, uuid.UUID(doctor_id))
    if not doctor or doctor.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Doctor not found")

    update_data = body.model_dump(exclude_unset=True)
    field_map = {
        "full_name": "name",
        "years_experience": "years_exp",
        "bio_en": "bio",
        "languages_spoken": "languages",
    }
    for field, value in update_data.items():
        attr = field_map.get(field, field)
        setattr(doctor, attr, value)

    doctor.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(doctor)
    return _doctor_to_out(doctor)


@router.delete("/doctors/{doctor_id}")
async def delete_doctor(
    doctor_id: str,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    doctor = await db.get(Doctor, uuid.UUID(doctor_id))
    if not doctor or doctor.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Check for future confirmed bookings
    from datetime import date as _date

    future_bookings = (await db.execute(
        select(Booking).where(
            Booking.doctor_id == doctor.id,
            Booking.status.in_(["pending", "confirmed"]),
            Booking.start_date >= _date.today(),
        )
    )).scalars().all()

    if future_bookings:
        dates = [str(b.start_date) for b in future_bookings]
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Cannot deactivate: doctor has future bookings",
                "affected_dates": dates,
            },
        )

    doctor.is_active = False
    doctor.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": doctor_id, "is_active": False}


@router.post("/doctors/{doctor_id}/certifications")
async def upload_certification(
    doctor_id: str,
    file: UploadFile,
    user: User = Depends(require_clinic_admin),
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    doctor = await db.get(Doctor, uuid.UUID(doctor_id))
    if not doctor or doctor.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Doctor not found")

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files accepted")

    file_data = await file.read()
    if len(file_data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

    s3_key, url = upload_pdf_to_s3(file_data, str(clinic.id), str(doctor.id))

    certs = doctor.doctor_certifications or []
    if isinstance(certs, dict):
        certs = certs.get("files", [])
    certs.append({
        "filename": file.filename,
        "s3_key": s3_key,
        "url": url,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": str(user.id),
    })
    doctor.doctor_certifications = {"files": certs}
    doctor.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {"doctor_id": doctor_id, "certifications": doctor.doctor_certifications}
