"""
api/users.py — User data endpoints.

All endpoints accept EITHER a Bearer token (authenticated user) OR read
session_id from request.state (guest). The get_identity() helper resolves
which identity to use — at least one is always present thanks to the
GuestSessionMiddleware.

GET    /api/users/me/watchlist?type=clinic
POST   /api/users/me/watchlist
DELETE /api/users/me/watchlist/{id}
GET    /api/users/me/bookings        (auth required)
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from db.database import get_db
from db.models import (
    Booking,
    Retreat,
    User,
    UserWatchlist,
)

router = APIRouter(prefix="/api/users", tags=["users"])

_AUTH_REQUIRED_DETAIL = "Sign in to view your history"
_AUTH_REQUIRED_BODY = {"detail": _AUTH_REQUIRED_DETAIL, "sign_in_url": "/login"}


# ── Identity resolution ────────────────────────────────────────────────────────

def get_identity(request: Request) -> tuple[uuid.UUID | None, uuid.UUID | None]:
    """
    Returns (user_id, session_id).
    Reads user_id from Bearer token (if valid), session_id from request.state.
    At least session_id is always set (injected by GuestSessionMiddleware).
    """
    user_id: uuid.UUID | None = None
    session_id: uuid.UUID | None = getattr(request.state, "session_id", None)

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            payload = jwt.decode(
                auth_header.split(" ", 1)[1],
                settings.JWT_SECRET,
                algorithms=["HS256"],
            )
            if payload.get("type") == "access" and payload.get("sub"):
                user_id = uuid.UUID(payload["sub"])
        except (JWTError, ValueError):
            pass

    return user_id, session_id


def _require_auth(request: Request) -> uuid.UUID:
    """Raises 401 with a soft-nudge body if the request is unauthenticated."""
    user_id, _ = get_identity(request)
    if not user_id:
        raise HTTPException(status_code=401, detail=_AUTH_REQUIRED_DETAIL)
    return user_id


# ── Pydantic models ────────────────────────────────────────────────────────────

class WatchlistOut(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    notes: str | None
    created_at: datetime


class WatchlistIn(BaseModel):
    entity_type: str
    entity_id: str
    notes: str | None = None


class BookingHistoryOut(BaseModel):
    id: str
    clinic_id: str
    retreat_name: str
    start_date: str
    end_date: str
    nights: int
    guest_count: int
    total_paid: float | None
    status: str
    created_at: datetime


# ── Watchlist ──────────────────────────────────────────────────────────────────

@router.get("/me/watchlist", response_model=list[WatchlistOut])
async def get_watchlist(
    request: Request,
    type: str | None = Query(None, alias="type"),
    db: AsyncSession = Depends(get_db),
):
    user_id, session_id = get_identity(request)

    if user_id:
        q = select(UserWatchlist).where(UserWatchlist.user_id == user_id)
    elif session_id:
        q = select(UserWatchlist).where(UserWatchlist.session_id == session_id)
    else:
        return []

    if type == "clinic":
        q = q.where(UserWatchlist.entity_type == type)

    result = await db.execute(q.order_by(UserWatchlist.created_at.desc()))
    rows = result.scalars().all()

    return [
        WatchlistOut(
            id=str(r.id),
            entity_type=r.entity_type,
            entity_id=str(r.entity_id),
            notes=r.notes,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/me/watchlist", response_model=WatchlistOut, status_code=201)
async def add_to_watchlist(
    body: WatchlistIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id, session_id = get_identity(request)
    if not user_id and not session_id:
        raise HTTPException(status_code=400, detail="No identity found")

    if body.entity_type != "clinic":
        raise HTTPException(status_code=422, detail="entity_type must be 'clinic'")

    try:
        entity_uuid = uuid.UUID(body.entity_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="entity_id must be a valid UUID")

    item = UserWatchlist(
        user_id=user_id,
        session_id=session_id,
        entity_type=body.entity_type,
        entity_id=entity_uuid,
        notes=body.notes,
    )
    db.add(item)
    await db.flush()

    return WatchlistOut(
        id=str(item.id),
        entity_type=item.entity_type,
        entity_id=str(item.entity_id),
        notes=item.notes,
        created_at=item.created_at,
    )


@router.delete("/me/watchlist/{item_id}", status_code=204)
async def remove_from_watchlist(
    item_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id, session_id = get_identity(request)

    try:
        item = await db.get(UserWatchlist, uuid.UUID(item_id))
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid watchlist item ID")

    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")

    owner_match = (user_id and item.user_id == user_id) or (
        session_id and item.session_id == session_id
    )
    if not owner_match:
        raise HTTPException(status_code=403, detail="Not your watchlist item")

    await db.delete(item)


# ── Auth-required history endpoints ───────────────────────────────────────────

@router.get("/me/bookings", response_model=list[BookingHistoryOut])
async def get_bookings(request: Request, db: AsyncSession = Depends(get_db)):
    user_id = _require_auth(request)

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    rows = (await db.execute(
        select(Booking, Retreat)
        .outerjoin(Retreat, Booking.retreat_id == Retreat.id)
        .where(Booking.guest_email == user.email)
        .order_by(Booking.created_at.desc())
    )).all()

    return [
        BookingHistoryOut(
            id=str(b.id),
            clinic_id=str(b.clinic_id),
            retreat_name=r.name if r else "—",
            start_date=str(b.start_date),
            end_date=str(b.end_date),
            nights=(b.end_date - b.start_date).days if b.end_date and b.start_date else 0,
            guest_count=b.guest_count or 1,
            total_paid=float(b.total_amount) if b.total_amount is not None else None,
            status=b.status,
            created_at=b.created_at,
        )
        for b, r in rows
    ]
