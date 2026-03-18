"""
core/storage.py — S3 upload helper with Pillow image processing.

- Validates file type and size (max 10MB, jpg/png/webp)
- Resizes images: hero → 1920x1080, gallery → 1200x800, profiles → 400x400
- Converts to webp (quality=85) before upload
- Returns S3 key and public URL
"""

import io
import uuid
from typing import BinaryIO

import boto3
from PIL import Image

from core.config import settings

# Max dimensions per image type
IMAGE_SIZES = {
    "clinic_hero": (1920, 1080),
    "clinic_gallery": (1200, 800),
    "clinic_logo": (400, 400),
    "doctor_profile": (400, 400),
    "doctor_gallery": (1200, 800),
    "treatment": (1200, 800),
    "certificate": (1200, 1600),
    "room": (1200, 800),
}

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def _get_s3_client():
    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def _build_url(s3_key: str) -> str:
    """Return CDN URL if CloudFront configured, otherwise direct S3 URL."""
    cloudfront = getattr(settings, "AWS_CLOUDFRONT_URL", "")
    if cloudfront:
        return f"{cloudfront.rstrip('/')}/{s3_key}"
    return f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}"


def process_image(file_data: bytes, image_type: str) -> bytes:
    """Resize and convert image to webp."""
    img = Image.open(io.BytesIO(file_data))

    # Convert RGBA to RGB (webp supports both but this avoids issues)
    if img.mode in ("RGBA", "LA", "P"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        background.paste(img, mask=img.split()[-1] if "A" in img.mode else None)
        img = background

    # Resize maintaining aspect ratio
    max_size = IMAGE_SIZES.get(image_type, (1200, 800))
    img.thumbnail(max_size, Image.LANCZOS)

    # Convert to webp
    output = io.BytesIO()
    img.save(output, format="WEBP", quality=85)
    output.seek(0)
    return output.read()


def upload_to_s3(
    file_data: bytes,
    s3_key: str,
    content_type: str = "image/webp",
) -> str:
    """Upload file to S3 and return the public URL."""
    client = _get_s3_client()
    client.put_object(
        Bucket=settings.AWS_S3_BUCKET,
        Key=s3_key,
        Body=file_data,
        ContentType=content_type,
    )
    return _build_url(s3_key)


def delete_from_s3(s3_key: str) -> None:
    """Delete a file from S3."""
    client = _get_s3_client()
    client.delete_object(
        Bucket=settings.AWS_S3_BUCKET,
        Key=s3_key,
    )


def generate_s3_key(
    clinic_id: str,
    image_type: str,
    doctor_id: str | None = None,
    extension: str = "webp",
) -> str:
    """Generate an S3 key following the folder structure convention."""
    file_id = uuid.uuid4().hex[:16]
    type_folder_map = {
        "clinic_hero": f"clinics/{clinic_id}/hero/{file_id}.{extension}",
        "clinic_gallery": f"clinics/{clinic_id}/gallery/{file_id}.{extension}",
        "clinic_logo": f"clinics/{clinic_id}/logo/{file_id}.{extension}",
        "room": f"clinics/{clinic_id}/rooms/{file_id}.{extension}",
        "doctor_profile": f"clinics/{clinic_id}/doctors/{doctor_id}/profile/{file_id}.{extension}",
        "doctor_gallery": f"clinics/{clinic_id}/doctors/{doctor_id}/gallery/{file_id}.{extension}",
        "certificate": f"clinics/{clinic_id}/doctors/{doctor_id}/certs/{file_id}.{extension}",
        "treatment": f"clinics/{clinic_id}/treatments/{file_id}.{extension}",
    }
    return type_folder_map.get(image_type, f"clinics/{clinic_id}/other/{file_id}.{extension}")


def upload_pdf_to_s3(
    file_data: bytes,
    clinic_id: str,
    doctor_id: str,
) -> tuple[str, str]:
    """Upload a PDF certification document. Returns (s3_key, s3_url)."""
    file_id = uuid.uuid4().hex[:16]
    s3_key = f"clinics/{clinic_id}/doctors/{doctor_id}/certs/{file_id}.pdf"
    url = upload_to_s3(file_data, s3_key, content_type="application/pdf")
    return s3_key, url
