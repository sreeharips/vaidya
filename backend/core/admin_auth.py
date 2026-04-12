"""
core/admin_auth.py — Role-based admin access dependencies.

Two admin roles (on users.role):
  - clinic_admin: manages their own clinic only
  - platform_admin: manages all clinics; can pass X-Platform-Clinic header
                    to act on behalf of any clinic via get_admin_clinic
"""

import uuid

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user
from db.database import get_db
from db.models import ClinicFeatureStore, User


async def require_clinic_admin(
    user: User = Depends(get_current_user),
) -> User:
    """Raises 403 if user is not a clinic_admin."""
    if user.role != "clinic_admin":
        # #region agent log
        try:
            import json
            import time
            _p = "/Users/sreeharisivadasan/vaidya/.cursor/debug-ee0189.log"
            with open(_p, "a", encoding="utf-8") as _lf:
                _lf.write(
                    json.dumps(
                        {
                            "sessionId": "ee0189",
                            "hypothesisId": "H1",
                            "location": "admin_auth.require_clinic_admin",
                            "message": "rejected non-clinic_admin",
                            "data": {"user_role": user.role},
                            "timestamp": int(time.time() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        raise HTTPException(status_code=403, detail="Clinic admin access required")
    return user



async def require_platform_admin(
    user: User = Depends(get_current_user),
) -> User:
    """Raises 403 if user is not a platform_admin."""
    if user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Platform admin access required")
    return user


async def require_any_admin(
    user: User = Depends(get_current_user),
) -> User:
    """Raises 403 if user is not clinic_admin or platform_admin."""
    if user.role not in ("clinic_admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def get_admin_clinic(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClinicFeatureStore:
    """Returns the clinic row for this admin session.

    - clinic_admin: resolved via admin_user_id or user.clinic_id
    - platform_admin: must supply X-Platform-Clinic header with a clinic UUID
                      (allows platform admin to act on behalf of any clinic)
    """
    if user.role not in ("clinic_admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    # Platform admin with override header
    if user.role == "platform_admin":
        override = request.headers.get("X-Platform-Clinic")
        if not override:
            raise HTTPException(
                status_code=400,
                detail="Platform admins must supply X-Platform-Clinic header to manage a clinic",
            )
        try:
            clinic_uuid = uuid.UUID(override)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid clinic ID in X-Platform-Clinic header")

        clinic = await db.get(ClinicFeatureStore, clinic_uuid)
        if not clinic:
            raise HTTPException(status_code=404, detail="Clinic not found")
        return clinic

    # Clinic admin: resolve from their own account
    result = await db.execute(
        select(ClinicFeatureStore).where(ClinicFeatureStore.admin_user_id == user.id)
    )
    clinic = result.scalar_one_or_none()

    if clinic is None and user.clinic_id is not None:
        clinic = await db.get(ClinicFeatureStore, user.clinic_id)

    if clinic is None:
        raise HTTPException(status_code=404, detail="No clinic linked to this account")

    return clinic
