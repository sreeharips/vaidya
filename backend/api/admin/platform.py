"""
api/admin/platform.py — Platform (super) admin endpoints.

Requires platform_admin role.

GET    /api/admin/platform/stats
GET    /api/admin/platform/clinics
POST   /api/admin/platform/clinics
GET    /api/admin/platform/clinics/{id}
PATCH  /api/admin/platform/clinics/{id}
...
GET    /api/admin/platform/tags
POST   /api/admin/platform/tags
PATCH  /api/admin/platform/tags/{id}
DELETE /api/admin/platform/tags/{id}
POST   /api/admin/platform/tags/reorder
PATCH  /api/admin/platform/clinics/{id}/tier
PATCH  /api/admin/platform/clinics/{id}/activate
PATCH  /api/admin/platform/clinics/{id}/deactivate
POST   /api/admin/platform/clinics/{id}/invite
"""

import re
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import require_platform_admin
from db.database import get_db
from db.models import Booking, ClinicFeatureStore, ClinicImage, ClinicTeam, PlatformTag, Retreat, User

router = APIRouter(prefix="/platform")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _slug_from_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


# ── Pydantic models ───────────────────────────────────────────────────────────

class PlatformStats(BaseModel):
    total_clinics: int
    tier1_clinics: int
    tier2_clinics: int
    active_clinics: int
    total_bookings: int
    total_gmv: float
    total_revenue: float
    active_retreats: int
    total_team_members: int


class OnboardingStep(BaseModel):
    key: str
    label: str
    done: bool


class AdminUserInfo(BaseModel):
    id: str
    email: str
    full_name: str | None
    last_login_at: str | None


class PlatformClinicSummary(BaseModel):
    id: str
    name: str
    slug: str
    district: str | None
    tier: int
    is_active: bool
    team_count: int
    retreats_count: int
    images_count: int
    bookings_count: int
    revenue: float
    has_admin: bool
    onboarding_pct: int
    created_at: str


class PlatformClinicDetail(BaseModel):
    id: str
    name: str
    slug: str
    district: str | None
    description: str | None
    address: str | None
    lat: float | None
    lng: float | None
    tier: int
    is_active: bool
    phone: str | None
    email: str | None
    website_url: str | None
    specialisations: list[str]
    atmosphere: list[str]
    certifications: list[str]
    languages: list[str]
    established_year: int | None
    pricing_min: float | None
    pricing_max: float | None
    team_count: int
    retreats_count: int
    images_count: int
    bookings_count: int
    revenue: float
    admin_user: AdminUserInfo | None
    onboarding: list[OnboardingStep]
    created_at: str


class ClinicCreate(BaseModel):
    name: str
    slug: str | None = None  # auto-generated if omitted
    district: str
    description: str | None = None
    tier: int = 1
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    phone: str | None = None
    email: str | None = None
    website_url: str | None = None
    specialisations: list[str] = []
    atmosphere: list[str] = []
    certifications: list[str] = []
    languages: list[str] = []
    pricing_min: float | None = None
    pricing_max: float | None = None


class ClinicUpdate(BaseModel):
    name: str | None = None
    district: str | None = None
    description: str | None = None
    tier: int | None = None
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    phone: str | None = None
    email: str | None = None
    website_url: str | None = None
    specialisations: list[str] | None = None
    atmosphere: list[str] | None = None
    certifications: list[str] | None = None
    languages: list[str] | None = None
    pricing_min: float | None = None
    pricing_max: float | None = None


class TierUpgrade(BaseModel):
    tier: int
    notes: str | None = None


class InviteAdmin(BaseModel):
    email: EmailStr
    full_name: str
    password: str


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _clinic_counts(db: AsyncSession, clinic_id: uuid.UUID):
    team_count = (await db.execute(
        select(func.count(ClinicTeam.id)).where(ClinicTeam.clinic_id == clinic_id)
    )).scalar_one()

    retreats_count = (await db.execute(
        select(func.count(Retreat.id)).where(Retreat.clinic_id == clinic_id)
    )).scalar_one()

    images_count = (await db.execute(
        select(func.count(ClinicImage.id)).where(ClinicImage.clinic_id == clinic_id)
    )).scalar_one()

    bookings = (await db.execute(
        select(Booking).where(Booking.clinic_id == clinic_id)
    )).scalars().all()

    revenue = sum(
        float(b.total_amount or 0) for b in bookings
        if b.status in ("confirmed", "completed", "payment_received")
    )

    return team_count, retreats_count, images_count, len(bookings), round(revenue, 2)


def _build_onboarding(
    clinic: ClinicFeatureStore,
    team_count: int,
    retreats_count: int,
    images_count: int,
    admin_user: User | None,
) -> list[OnboardingStep]:
    description = clinic.description_en or ""
    return [
        OnboardingStep(key="clinic_created",   label="Clinic profile created",        done=True),
        OnboardingStep(key="description",      label="Description added",              done=len(description) > 50),
        OnboardingStep(key="photos",           label="Photos uploaded",                done=images_count > 0),
        OnboardingStep(key="team",             label="Team members added",             done=team_count > 0),
        OnboardingStep(key="retreats",         label="Retreat packages created",       done=retreats_count > 0),
        OnboardingStep(key="admin_created",    label="Clinic admin account created",   done=admin_user is not None),
        OnboardingStep(key="admin_logged_in",  label="Admin completed first login",    done=admin_user is not None and admin_user.last_login_at is not None),
        OnboardingStep(key="activated",        label="Clinic set live (active)",       done=clinic.is_active),
    ]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=PlatformStats)
async def platform_stats(
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    total_clinics  = (await db.execute(select(func.count(ClinicFeatureStore.id)))).scalar_one()
    tier1_clinics  = (await db.execute(select(func.count(ClinicFeatureStore.id)).where(ClinicFeatureStore.tier == 1))).scalar_one()
    tier2_clinics  = (await db.execute(select(func.count(ClinicFeatureStore.id)).where(ClinicFeatureStore.tier == 2))).scalar_one()
    active_clinics = (await db.execute(select(func.count(ClinicFeatureStore.id)).where(ClinicFeatureStore.is_active.is_(True)))).scalar_one()
    total_team     = (await db.execute(select(func.count(ClinicTeam.id)))).scalar_one()
    total_bookings = (await db.execute(select(func.count(Booking.id)))).scalar_one()
    active_retreats = (await db.execute(select(func.count(Retreat.id)).where(Retreat.is_active.is_(True)))).scalar_one()

    gmv_result = await db.execute(select(func.sum(Booking.total_amount)))
    total_gmv = float(gmv_result.scalar_one() or 0)

    rev_result = await db.execute(select(func.sum(Booking.commission_amount)))
    total_revenue = float(rev_result.scalar_one() or 0)

    return PlatformStats(
        total_clinics=total_clinics,
        tier1_clinics=tier1_clinics,
        tier2_clinics=tier2_clinics,
        active_clinics=active_clinics,
        total_bookings=total_bookings,
        total_gmv=round(total_gmv, 2),
        total_revenue=round(total_revenue, 2),
        active_retreats=active_retreats,
        total_team_members=total_team,
    )


@router.get("/clinics", response_model=list[PlatformClinicSummary])
async def list_all_clinics(
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    clinics = (await db.execute(
        select(ClinicFeatureStore).order_by(ClinicFeatureStore.created_at.desc())
    )).scalars().all()

    result = []
    for c in clinics:
        team_count, retreats_count, images_count, bookings_count, revenue = await _clinic_counts(db, c.id)

        admin_user = None
        if c.admin_user_id:
            admin_user = await db.get(User, c.admin_user_id)

        onboarding = _build_onboarding(c, team_count, retreats_count, images_count, admin_user)
        done_steps = sum(1 for s in onboarding if s.done)
        onboarding_pct = round((done_steps / len(onboarding)) * 100)

        result.append(PlatformClinicSummary(
            id=str(c.id),
            name=c.name,
            slug=c.slug,
            district=c.district,
            tier=c.tier,
            is_active=c.is_active,
            team_count=team_count,
            retreats_count=retreats_count,
            images_count=images_count,
            bookings_count=bookings_count,
            revenue=revenue,
            has_admin=admin_user is not None,
            onboarding_pct=onboarding_pct,
            created_at=c.created_at.isoformat(),
        ))

    return result


@router.post("/clinics", response_model=PlatformClinicDetail, status_code=201)
async def create_clinic(
    body: ClinicCreate,
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    slug = body.slug or _slug_from_name(body.name)

    # Ensure slug uniqueness
    existing = (await db.execute(
        select(ClinicFeatureStore).where(ClinicFeatureStore.slug == slug)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Slug '{slug}' already in use")

    now = datetime.now(timezone.utc)
    clinic = ClinicFeatureStore(
        id=uuid.uuid4(),
        slug=slug,
        name=body.name,
        tier=body.tier,
        district=body.district,
        description_en=body.description,
        address=body.address,
        lat=body.lat,
        lng=body.lng,
        phone=body.phone,
        email=body.email,
        website_url=body.website_url,
        specialisations=body.specialisations,
        atmosphere=body.atmosphere,
        certifications=body.certifications,
        languages=body.languages,
        pricing_min=body.pricing_min,
        pricing_max=body.pricing_max,
        is_active=False,  # starts inactive until onboarding complete
        created_at=now,
        updated_at=now,
    )
    db.add(clinic)
    await db.commit()
    await db.refresh(clinic)

    onboarding = _build_onboarding(clinic, 0, 0, 0, None)
    return PlatformClinicDetail(
        id=str(clinic.id),
        name=clinic.name,
        slug=clinic.slug,
        district=clinic.district,
        description=clinic.description_en,
        address=clinic.address,
        lat=clinic.lat,
        lng=clinic.lng,
        tier=clinic.tier,
        is_active=clinic.is_active,
        phone=clinic.phone,
        email=clinic.email,
        website_url=clinic.website_url,
        specialisations=clinic.specialisations or [],
        atmosphere=clinic.atmosphere or [],
        certifications=clinic.certifications or [],
        languages=clinic.languages or [],
        established_year=clinic.established_year,
        pricing_min=float(clinic.pricing_min) if clinic.pricing_min else None,
        pricing_max=float(clinic.pricing_max) if clinic.pricing_max else None,
        team_count=0,
        retreats_count=0,
        images_count=0,
        bookings_count=0,
        revenue=0.0,
        admin_user=None,
        onboarding=onboarding,
        created_at=clinic.created_at.isoformat(),
    )


@router.get("/clinics/{clinic_id}", response_model=PlatformClinicDetail)
async def get_clinic_detail(
    clinic_id: str,
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    clinic = await db.get(ClinicFeatureStore, uuid.UUID(clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    team_count, retreats_count, images_count, bookings_count, revenue = await _clinic_counts(db, clinic.id)

    admin_user = None
    if clinic.admin_user_id:
        admin_user = await db.get(User, clinic.admin_user_id)

    onboarding = _build_onboarding(clinic, team_count, retreats_count, images_count, admin_user)

    return PlatformClinicDetail(
        id=str(clinic.id),
        name=clinic.name,
        slug=clinic.slug,
        district=clinic.district,
        description=clinic.description_en,
        address=clinic.address,
        lat=clinic.lat,
        lng=clinic.lng,
        tier=clinic.tier,
        is_active=clinic.is_active,
        phone=clinic.phone,
        email=clinic.email,
        website_url=clinic.website_url,
        specialisations=clinic.specialisations or [],
        atmosphere=clinic.atmosphere or [],
        certifications=clinic.certifications or [],
        languages=clinic.languages or [],
        established_year=clinic.established_year,
        pricing_min=float(clinic.pricing_min) if clinic.pricing_min else None,
        pricing_max=float(clinic.pricing_max) if clinic.pricing_max else None,
        team_count=team_count,
        retreats_count=retreats_count,
        images_count=images_count,
        bookings_count=bookings_count,
        revenue=revenue,
        admin_user=AdminUserInfo(
            id=str(admin_user.id),
            email=admin_user.email,
            full_name=admin_user.full_name,
            last_login_at=admin_user.last_login_at.isoformat() if admin_user.last_login_at else None,
        ) if admin_user else None,
        onboarding=onboarding,
        created_at=clinic.created_at.isoformat(),
    )


@router.patch("/clinics/{clinic_id}", response_model=PlatformClinicDetail)
async def update_clinic(
    clinic_id: str,
    body: ClinicUpdate,
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    clinic = await db.get(ClinicFeatureStore, uuid.UUID(clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "description":
            clinic.description_en = value
        else:
            setattr(clinic, field, value)

    clinic.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(clinic)

    team_count, retreats_count, images_count, bookings_count, revenue = await _clinic_counts(db, clinic.id)
    admin_user = await db.get(User, clinic.admin_user_id) if clinic.admin_user_id else None
    onboarding = _build_onboarding(clinic, team_count, retreats_count, images_count, admin_user)

    return PlatformClinicDetail(
        id=str(clinic.id),
        name=clinic.name,
        slug=clinic.slug,
        district=clinic.district,
        description=clinic.description_en,
        address=clinic.address,
        lat=clinic.lat,
        lng=clinic.lng,
        tier=clinic.tier,
        is_active=clinic.is_active,
        phone=clinic.phone,
        email=clinic.email,
        website_url=clinic.website_url,
        specialisations=clinic.specialisations or [],
        atmosphere=clinic.atmosphere or [],
        certifications=clinic.certifications or [],
        languages=clinic.languages or [],
        established_year=clinic.established_year,
        pricing_min=float(clinic.pricing_min) if clinic.pricing_min else None,
        pricing_max=float(clinic.pricing_max) if clinic.pricing_max else None,
        team_count=team_count,
        retreats_count=retreats_count,
        images_count=images_count,
        bookings_count=bookings_count,
        revenue=revenue,
        admin_user=AdminUserInfo(
            id=str(admin_user.id),
            email=admin_user.email,
            full_name=admin_user.full_name,
            last_login_at=admin_user.last_login_at.isoformat() if admin_user.last_login_at else None,
        ) if admin_user else None,
        onboarding=onboarding,
        created_at=clinic.created_at.isoformat(),
    )


@router.patch("/clinics/{clinic_id}/tier")
async def upgrade_tier(
    clinic_id: str,
    body: TierUpgrade,
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    clinic = await db.get(ClinicFeatureStore, uuid.UUID(clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.tier = body.tier
    clinic.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"clinic_id": clinic_id, "tier": body.tier}


@router.patch("/clinics/{clinic_id}/activate")
async def activate_clinic(
    clinic_id: str,
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    clinic = await db.get(ClinicFeatureStore, uuid.UUID(clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.is_active = True
    clinic.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"clinic_id": clinic_id, "is_active": True}


@router.patch("/clinics/{clinic_id}/deactivate")
async def deactivate_clinic(
    clinic_id: str,
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    clinic = await db.get(ClinicFeatureStore, uuid.UUID(clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.is_active = False
    clinic.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"clinic_id": clinic_id, "is_active": False}


@router.post("/clinics/{clinic_id}/invite")
async def invite_clinic_admin(
    clinic_id: str,
    body: InviteAdmin,
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a clinic_admin user account and link it to the clinic."""
    clinic = await db.get(ClinicFeatureStore, uuid.UUID(clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    # Check email not already taken
    existing = (await db.execute(
        select(User).where(User.email == body.email)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    now = datetime.now(timezone.utc)
    admin = User(
        id=uuid.uuid4(),
        email=body.email,
        full_name=body.full_name,
        password_hash=_hash_password(body.password),
        role="clinic_admin",
        clinic_id=clinic.id,
        is_active=True,
        is_email_verified=True,
        created_at=now,
        updated_at=now,
    )
    db.add(admin)

    # Link clinic to this admin
    clinic.admin_user_id = admin.id
    clinic.updated_at = now

    await db.commit()
    await db.refresh(admin)

    return {
        "id": str(admin.id),
        "email": admin.email,
        "full_name": admin.full_name,
        "role": admin.role,
        "clinic_id": clinic_id,
    }


# ── Platform Tag Management ───────────────────────────────────────────────────

class PlatformTagOut(BaseModel):
    id: str
    type: str
    value: str
    is_active: bool
    sort_order: int


class PlatformTagCreate(BaseModel):
    type: str  # 'specialisation' | 'certification'
    value: str


class PlatformTagUpdate(BaseModel):
    value: str | None = None
    is_active: bool | None = None


class ReorderBody(BaseModel):
    ids: list[str]  # ordered list of tag ids


@router.get("/tags", response_model=list[PlatformTagOut])
async def list_tags(
    type: str | None = None,
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(PlatformTag).order_by(PlatformTag.sort_order, PlatformTag.value)
    if type:
        q = q.where(PlatformTag.type == type)
    tags = (await db.execute(q)).scalars().all()
    return [PlatformTagOut(id=str(t.id), type=t.type, value=t.value, is_active=t.is_active, sort_order=t.sort_order) for t in tags]


@router.post("/tags", response_model=PlatformTagOut, status_code=201)
async def create_tag(
    body: PlatformTagCreate,
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    if body.type not in ("specialisation", "certification"):
        raise HTTPException(status_code=400, detail="type must be 'specialisation' or 'certification'")

    existing = (await db.execute(
        select(PlatformTag).where(PlatformTag.type == body.type, PlatformTag.value == body.value.strip())
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"'{body.value}' already exists in {body.type}s")

    max_order = (await db.execute(
        select(func.max(PlatformTag.sort_order)).where(PlatformTag.type == body.type)
    )).scalar_one() or 0

    tag = PlatformTag(
        id=uuid.uuid4(),
        type=body.type,
        value=body.value.strip(),
        is_active=True,
        sort_order=max_order + 1,
        created_at=datetime.now(timezone.utc),
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return PlatformTagOut(id=str(tag.id), type=tag.type, value=tag.value, is_active=tag.is_active, sort_order=tag.sort_order)


@router.patch("/tags/{tag_id}", response_model=PlatformTagOut)
async def update_tag(
    tag_id: str,
    body: PlatformTagUpdate,
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    tag = await db.get(PlatformTag, uuid.UUID(tag_id))
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if body.value is not None:
        tag.value = body.value.strip()
    if body.is_active is not None:
        tag.is_active = body.is_active
    await db.commit()
    await db.refresh(tag)
    return PlatformTagOut(id=str(tag.id), type=tag.type, value=tag.value, is_active=tag.is_active, sort_order=tag.sort_order)


@router.delete("/tags/{tag_id}", status_code=204)
async def delete_tag(
    tag_id: str,
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    tag = await db.get(PlatformTag, uuid.UUID(tag_id))
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    await db.delete(tag)
    await db.commit()


@router.post("/tags/reorder")
async def reorder_tags(
    body: ReorderBody,
    user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    for i, tag_id in enumerate(body.ids):
        tag = await db.get(PlatformTag, uuid.UUID(tag_id))
        if tag:
            tag.sort_order = i
    await db.commit()
    return {"reordered": len(body.ids)}
