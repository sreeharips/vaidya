"""
api/admin/team.py — Team member management for clinic admins.
"""

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic, require_clinic_admin
from core.storage import ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE, generate_s3_key, process_image, upload_to_s3
from db.database import get_db
from db.models import ClinicFeatureStore, ClinicTeam, User

router = APIRouter()


class TeamMemberOut(BaseModel):
    id: str
    name: str
    name_ml: str | None
    name_ar: str | None
    qualification: str | None
    years_experience: int | None
    bio_en: str | None
    bio_ml: str | None
    photo_url: str | None
    display_order: int
    is_active: bool

class TeamMemberCreate(BaseModel):
    name: str
    name_ml: str | None = None
    name_ar: str | None = None
    qualification: str | None = None
    years_experience: int | None = None
    bio_en: str | None = None
    bio_ml: str | None = None
    display_order: int = 0

class TeamMemberUpdate(BaseModel):
    name: str | None = None
    name_ml: str | None = None
    name_ar: str | None = None
    qualification: str | None = None
    years_experience: int | None = None
    bio_en: str | None = None
    bio_ml: str | None = None
    display_order: int | None = None
    is_active: bool | None = None


def _member_out(m: ClinicTeam) -> TeamMemberOut:
    return TeamMemberOut(
        id=str(m.id), name=m.name, name_ml=m.name_ml, name_ar=m.name_ar,
        qualification=m.qualification, years_experience=m.years_experience,
        bio_en=m.bio_en, bio_ml=m.bio_ml, photo_url=m.photo_url,
        display_order=m.display_order, is_active=m.is_active,
    )


@router.get("/team", response_model=list[TeamMemberOut])
async def list_team(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ClinicTeam).where(ClinicTeam.clinic_id == clinic.id)
        .order_by(ClinicTeam.display_order, ClinicTeam.name)
    )
    return [_member_out(m) for m in result.scalars().all()]


@router.post("/team", response_model=TeamMemberOut, status_code=201)
async def create_team_member(
    body: TeamMemberCreate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    member = ClinicTeam(
        clinic_id=clinic.id,
        name=body.name, name_ml=body.name_ml, name_ar=body.name_ar,
        qualification=body.qualification, years_experience=body.years_experience,
        bio_en=body.bio_en, bio_ml=body.bio_ml, display_order=body.display_order,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return _member_out(member)


@router.patch("/team/{member_id}", response_model=TeamMemberOut)
async def update_team_member(
    member_id: str,
    body: TeamMemberUpdate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    member = await db.get(ClinicTeam, uuid.UUID(member_id))
    if not member or member.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Team member not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(member, field, value)

    await db.commit()
    await db.refresh(member)
    return _member_out(member)


@router.delete("/team/{member_id}")
async def delete_team_member(
    member_id: str,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    member = await db.get(ClinicTeam, uuid.UUID(member_id))
    if not member or member.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Team member not found")

    member.is_active = False
    await db.commit()
    return {"id": member_id, "is_active": False}


@router.post("/team/{member_id}/photo")
async def upload_team_photo(
    member_id: str,
    file: UploadFile = File(...),
    user: User = Depends(require_clinic_admin),
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    member = await db.get(ClinicTeam, uuid.UUID(member_id))
    if not member or member.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Team member not found")

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="File type not allowed. Accepted: jpg, png, webp")

    file_data = await file.read()
    if len(file_data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

    processed = process_image(file_data, "team_photo")
    s3_key = generate_s3_key(clinic_id=str(clinic.id), image_type="team_photo")
    s3_url = upload_to_s3(processed, s3_key)

    member.photo_url = s3_url
    await db.commit()

    return {"photo_url": s3_url}
