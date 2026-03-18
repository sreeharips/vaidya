"""
api/admin/images.py — Clinic image management.

POST   /api/admin/images/upload
GET    /api/admin/images
PATCH  /api/admin/images/{id}
DELETE /api/admin/images/{id}
POST   /api/admin/images/reorder
"""

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic, require_clinic_admin
from core.storage import (
    ALLOWED_CONTENT_TYPES,
    MAX_FILE_SIZE,
    delete_from_s3,
    generate_s3_key,
    process_image,
    upload_to_s3,
)
from db.database import get_db
from db.models import ClinicFeatureStore, ClinicImage, User

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────────────────────

class ImageOut(BaseModel):
    id: str
    s3_url: str
    image_type: str
    display_order: int
    alt_text: str | None
    doctor_id: str | None
    created_at: str


class ImageUpdate(BaseModel):
    display_order: int | None = None
    alt_text: str | None = None


class ReorderItem(BaseModel):
    id: str
    display_order: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/images/upload", response_model=ImageOut)
async def upload_image(
    file: UploadFile = File(...),
    image_type: str = Form(...),
    doctor_id: str | None = Form(default=None),
    user: User = Depends(require_clinic_admin),
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    # Validate content type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Accepted: jpg, png, webp")

    # Validate image_type
    valid_types = {"clinic_hero", "clinic_gallery", "clinic_logo", "doctor_profile", "doctor_gallery", "treatment", "certificate", "room"}
    if image_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid image_type. Must be one of: {', '.join(valid_types)}")

    # Read and validate size
    file_data = await file.read()
    if len(file_data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

    # Process image (resize + convert to webp)
    processed = process_image(file_data, image_type)

    # Generate S3 key and upload
    s3_key = generate_s3_key(
        clinic_id=str(clinic.id),
        image_type=image_type,
        doctor_id=doctor_id,
    )
    s3_url = upload_to_s3(processed, s3_key)

    # Save to DB
    image = ClinicImage(
        clinic_id=clinic.id,
        doctor_id=uuid.UUID(doctor_id) if doctor_id else None,
        image_type=image_type,
        s3_key=s3_key,
        s3_url=s3_url,
        uploaded_by=user.id,
    )
    db.add(image)
    await db.commit()
    await db.refresh(image)

    return ImageOut(
        id=str(image.id),
        s3_url=image.s3_url,
        image_type=image.image_type,
        display_order=image.display_order,
        alt_text=image.alt_text,
        doctor_id=str(image.doctor_id) if image.doctor_id else None,
        created_at=image.created_at.isoformat(),
    )


@router.get("/images", response_model=list[ImageOut])
async def list_images(
    type: str | None = None,
    doctor_id: str | None = None,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    q = select(ClinicImage).where(ClinicImage.clinic_id == clinic.id)
    if type:
        q = q.where(ClinicImage.image_type == type)
    if doctor_id:
        q = q.where(ClinicImage.doctor_id == uuid.UUID(doctor_id))
    q = q.order_by(ClinicImage.display_order, ClinicImage.created_at)

    results = (await db.execute(q)).scalars().all()
    return [
        ImageOut(
            id=str(img.id),
            s3_url=img.s3_url,
            image_type=img.image_type,
            display_order=img.display_order,
            alt_text=img.alt_text,
            doctor_id=str(img.doctor_id) if img.doctor_id else None,
            created_at=img.created_at.isoformat(),
        )
        for img in results
    ]


@router.patch("/images/{image_id}", response_model=ImageOut)
async def update_image(
    image_id: str,
    body: ImageUpdate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    image = await db.get(ClinicImage, uuid.UUID(image_id))
    if not image or image.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Image not found")

    if body.display_order is not None:
        image.display_order = body.display_order
    if body.alt_text is not None:
        image.alt_text = body.alt_text

    await db.commit()
    await db.refresh(image)

    return ImageOut(
        id=str(image.id),
        s3_url=image.s3_url,
        image_type=image.image_type,
        display_order=image.display_order,
        alt_text=image.alt_text,
        doctor_id=str(image.doctor_id) if image.doctor_id else None,
        created_at=image.created_at.isoformat(),
    )


@router.delete("/images/{image_id}")
async def delete_image(
    image_id: str,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    image = await db.get(ClinicImage, uuid.UUID(image_id))
    if not image or image.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Image not found")

    # Delete from S3
    try:
        delete_from_s3(image.s3_key)
    except Exception:
        pass  # Best effort — DB row deletion is more important

    await db.delete(image)
    await db.commit()
    return {"deleted": image_id}


@router.post("/images/reorder")
async def reorder_images(
    items: list[ReorderItem],
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    for item in items:
        image = await db.get(ClinicImage, uuid.UUID(item.id))
        if image and image.clinic_id == clinic.id:
            image.display_order = item.display_order
    await db.commit()
    return {"reordered": len(items)}
