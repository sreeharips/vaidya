"""
core/admin_auth.py — Role-based admin access dependencies.

Two admin roles (on users.role):
  - clinic_admin: manages their own clinic only
  - platform_admin: read-only overview of all clinics, can trigger tier upgrades
"""

import uuid

from fastapi import Depends, HTTPException
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
    user: User = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicFeatureStore:
    """Returns the clinic row owned by this admin user.

    Looks up clinic_feature_store where admin_user_id = user.id.
    Falls back to user.clinic_id if admin_user_id is not set.
    Raises 404 if no clinic is found.
    """
    # Try admin_user_id first
    result = await db.execute(
        select(ClinicFeatureStore).where(ClinicFeatureStore.admin_user_id == user.id)
    )
    clinic = result.scalar_one_or_none()

    # Fallback to user.clinic_id
    if clinic is None and user.clinic_id is not None:
        clinic = await db.get(ClinicFeatureStore, user.clinic_id)

    if clinic is None:
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
                            "hypothesisId": "H2",
                            "location": "admin_auth.get_admin_clinic",
                            "message": "no clinic for user",
                            "data": {"user_id": str(user.id), "role": user.role},
                            "timestamp": int(time.time() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        raise HTTPException(status_code=404, detail="No clinic linked to this account")

    return clinic
