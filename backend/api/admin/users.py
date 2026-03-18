"""
api/admin/users.py — User management for platform admins.

GET    /api/admin/users              — list all users (filterable by role)
GET    /api/admin/users/{id}         — single user detail
POST   /api/admin/users              — create user (any role)
PATCH  /api/admin/users/{id}         — update user fields
PATCH  /api/admin/users/{id}/role    — change role
PATCH  /api/admin/users/{id}/toggle  — activate / deactivate
DELETE /api/admin/users/{id}         — soft delete (deactivate)
"""

import asyncio
import uuid
from datetime import datetime, timezone

import bcrypt as _bcrypt
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import require_any_admin
from db.database import get_db
from db.models import ClinicFeatureStore, User

router = APIRouter()

VALID_ROLES = ("patient", "doctor", "clinic_admin", "platform_admin")


# ── Pydantic models ──────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: str
    email: str
    full_name: str | None
    phone: str | None
    preferred_language: str
    role: str
    is_active: bool
    is_email_verified: bool
    clinic_id: str | None
    clinic_name: str | None
    last_login_at: str | None
    created_at: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    phone: str | None = None
    preferred_language: str = "en"
    role: str = "patient"
    is_active: bool = True
    clinic_id: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    preferred_language: str | None = None
    email: EmailStr | None = None
    clinic_id: str | None = None


class RoleUpdate(BaseModel):
    role: str
    clinic_id: str | None = None


class UsersPage(BaseModel):
    items: list[UserOut]
    total: int


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


async def _user_to_out(user: User, db: AsyncSession) -> UserOut:
    clinic_name = None
    if user.clinic_id:
        clinic = await db.get(ClinicFeatureStore, user.clinic_id)
        if clinic:
            clinic_name = clinic.name

    return UserOut(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        preferred_language=user.preferred_language,
        role=user.role,
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        clinic_id=str(user.clinic_id) if user.clinic_id else None,
        clinic_name=clinic_name,
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
        created_at=user.created_at.isoformat(),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/users", response_model=UsersPage)
async def list_users(
    role: str | None = None,
    search: str | None = None,
    is_active: bool | None = None,
    limit: int = Query(default=50, le=100),
    offset: int = 0,
    admin: User = Depends(require_any_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(User)
    # Clinic admins can only see users in their own clinic
    if admin.role == "clinic_admin":
        q = q.where(User.clinic_id == admin.clinic_id)
    if role:
        q = q.where(User.role == role)
    if is_active is not None:
        q = q.where(User.is_active == is_active)
    if search:
        pattern = f"%{search}%"
        q = q.where(
            User.email.ilike(pattern) | User.full_name.ilike(pattern)
        )

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    results = (await db.execute(
        q.order_by(User.created_at.desc()).offset(offset).limit(limit)
    )).scalars().all()

    items = [await _user_to_out(u, db) for u in results]
    return UsersPage(items=items, total=total)


@router.get("/users/{user_id}", response_model=UserOut)
async def get_user(
    user_id: str,
    admin: User = Depends(require_any_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await _user_to_out(user, db)


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreate,
    admin: User = Depends(require_any_admin),
    db: AsyncSession = Depends(get_db),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    # Clinic admins can only create patients/doctors within their clinic
    if admin.role == "clinic_admin":
        if body.role in ("platform_admin", "clinic_admin"):
            raise HTTPException(status_code=403, detail="Cannot create users with this role")
        body.clinic_id = str(admin.clinic_id) if admin.clinic_id else body.clinic_id

    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    loop = asyncio.get_running_loop()
    password_hash = await loop.run_in_executor(None, _hash_password, body.password)

    clinic_uuid = uuid.UUID(body.clinic_id) if body.clinic_id else None

    user = User(
        email=body.email,
        password_hash=password_hash,
        full_name=body.full_name,
        phone=body.phone,
        preferred_language=body.preferred_language,
        role=body.role,
        is_active=body.is_active,
        is_email_verified=True,  # admin-created users skip verification
        clinic_id=clinic_uuid,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return await _user_to_out(user, db)


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    body: UserUpdate,
    admin: User = Depends(require_any_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = body.model_dump(exclude_unset=True)

    if "email" in update_data:
        existing = (await db.execute(
            select(User).where(User.email == update_data["email"], User.id != user.id)
        )).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")

    if "clinic_id" in update_data:
        update_data["clinic_id"] = uuid.UUID(update_data["clinic_id"]) if update_data["clinic_id"] else None

    for field, value in update_data.items():
        setattr(user, field, value)
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    return await _user_to_out(user, db)


@router.patch("/users/{user_id}/role", response_model=UserOut)
async def change_role(
    user_id: str,
    body: RoleUpdate,
    admin: User = Depends(require_any_admin),
    db: AsyncSession = Depends(get_db),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    # Clinic admins cannot assign admin roles
    if admin.role == "clinic_admin" and body.role in ("platform_admin", "clinic_admin"):
        raise HTTPException(status_code=403, detail="Cannot assign this role")

    user = await db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    # Clinic admins can only manage users in their clinic
    if admin.role == "clinic_admin" and user.clinic_id != admin.clinic_id:
        raise HTTPException(status_code=403, detail="Cannot manage users outside your clinic")

    user.role = body.role
    if body.clinic_id:
        user.clinic_id = uuid.UUID(body.clinic_id)
    elif body.role == "patient":
        user.clinic_id = None
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    return await _user_to_out(user, db)


@router.patch("/users/{user_id}/toggle", response_model=UserOut)
async def toggle_active(
    user_id: str,
    admin: User = Depends(require_any_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    user.is_active = not user.is_active
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    return await _user_to_out(user, db)


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin: User = Depends(require_any_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user.is_active = False
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": user_id, "is_active": False, "detail": "User deactivated"}
