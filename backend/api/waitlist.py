"""
api/waitlist.py — Pre-launch email waitlist.
REMOVE after product launch: delete this file, the waitlist_emails table, and the
include_router line in main.py.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import WaitlistEmail

router = APIRouter(prefix="/api/waitlist", tags=["waitlist"])


class WaitlistIn(BaseModel):
    email: EmailStr
    source: str | None = "landing"


class WaitlistOut(BaseModel):
    message: str
    position: int


@router.post("", response_model=WaitlistOut, status_code=201)
async def join_waitlist(body: WaitlistIn, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(
        select(WaitlistEmail).where(WaitlistEmail.email == body.email)
    )).scalar_one_or_none()

    if existing:
        count = (await db.execute(select(func.count()).select_from(WaitlistEmail))).scalar()
        raise HTTPException(status_code=409, detail={"message": "already_registered", "position": count})

    entry = WaitlistEmail(email=body.email, source=body.source)
    db.add(entry)
    await db.flush()

    count = (await db.execute(select(func.count()).select_from(WaitlistEmail))).scalar()
    return WaitlistOut(message="registered", position=count)


@router.get("/count")
async def waitlist_count(db: AsyncSession = Depends(get_db)):
    count = (await db.execute(select(func.count()).select_from(WaitlistEmail))).scalar()
    return {"count": count}
