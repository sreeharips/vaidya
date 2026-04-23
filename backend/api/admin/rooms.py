"""
api/admin/rooms.py — Room management for clinic admins (and super admin via override).

GET    /api/admin/rooms           — list clinic's rooms (all, incl. inactive)
POST   /api/admin/rooms           — create room
PATCH  /api/admin/rooms/{id}      — update room
DELETE /api/admin/rooms/{id}      — soft-delete (is_active = False)
POST   /api/admin/rooms/reorder   — set display_order by ordered ID list
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic
from db.database import get_db
from db.models import ClinicFeatureStore, Room

router = APIRouter()

ROOM_CATEGORIES = ("non_ac", "ac_standard", "deluxe", "suite")


# ── Schemas ────────────────────────────────────────────────────────────────────

class RoomOut(BaseModel):
    id: str
    name: str
    category: str
    description: str | None
    price_per_night_inr: float
    amenities: list[str]
    photos: list[str]
    max_occupancy: int
    is_active: bool
    display_order: int


class RoomCreate(BaseModel):
    name: str
    category: str = "non_ac"
    description: str | None = None
    price_per_night_inr: float = Field(gt=0)
    amenities: list[str] = []
    photos: list[str] = []
    max_occupancy: int = Field(default=2, ge=1, le=10)
    is_active: bool = True
    display_order: int = 0


class RoomUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    price_per_night_inr: float | None = Field(default=None, gt=0)
    amenities: list[str] | None = None
    photos: list[str] | None = None
    max_occupancy: int | None = Field(default=None, ge=1, le=10)
    is_active: bool | None = None
    display_order: int | None = None


class ReorderBody(BaseModel):
    ids: list[str]


def _to_out(room: Room) -> RoomOut:
    return RoomOut(
        id=str(room.id),
        name=room.name,
        category=room.category,
        description=room.description,
        price_per_night_inr=float(room.price_per_night_inr),
        amenities=room.amenities or [],
        photos=room.photos or [],
        max_occupancy=room.max_occupancy,
        is_active=room.is_active,
        display_order=room.display_order,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/rooms", response_model=list[RoomOut])
async def list_rooms(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(Room)
        .where(Room.clinic_id == clinic.id)
        .order_by(Room.display_order, Room.created_at)
    )).scalars().all()
    return [_to_out(r) for r in rows]


@router.post("/rooms", response_model=RoomOut, status_code=201)
async def create_room(
    body: RoomCreate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    if body.category not in ROOM_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"category must be one of {ROOM_CATEGORIES}")
    room = Room(
        clinic_id=clinic.id,
        name=body.name,
        category=body.category,
        description=body.description,
        price_per_night_inr=body.price_per_night_inr,
        amenities=body.amenities,
        photos=body.photos,
        max_occupancy=body.max_occupancy,
        is_active=body.is_active,
        display_order=body.display_order,
    )
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return _to_out(room)


@router.patch("/rooms/{room_id}", response_model=RoomOut)
async def update_room(
    room_id: str,
    body: RoomUpdate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    try:
        rid = uuid.UUID(room_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Room not found.")
    room = (await db.execute(
        select(Room).where(Room.id == rid, Room.clinic_id == clinic.id)
    )).scalar_one_or_none()
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found.")
    if body.category is not None and body.category not in ROOM_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"category must be one of {ROOM_CATEGORIES}")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(room, field, value)
    await db.commit()
    await db.refresh(room)
    return _to_out(room)


@router.delete("/rooms/{room_id}", status_code=204)
async def delete_room(
    room_id: str,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    try:
        rid = uuid.UUID(room_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Room not found.")
    room = (await db.execute(
        select(Room).where(Room.id == rid, Room.clinic_id == clinic.id)
    )).scalar_one_or_none()
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found.")
    room.is_active = False
    await db.commit()


@router.post("/rooms/reorder", status_code=204)
async def reorder_rooms(
    body: ReorderBody,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    for i, room_id_str in enumerate(body.ids):
        try:
            rid = uuid.UUID(room_id_str)
        except ValueError:
            continue
        room = (await db.execute(
            select(Room).where(Room.id == rid, Room.clinic_id == clinic.id)
        )).scalar_one_or_none()
        if room:
            room.display_order = i
    await db.commit()
