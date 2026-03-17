"""
api/auth.py — Authentication endpoints.

POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
PATCH /api/auth/me
GET  /api/auth/sso/{provider}   (placeholder)
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.session_claim import claim_session
from db.database import get_db
from db.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
REFRESH_TOKEN_EXPIRE_DAYS = 30


# ── Token helpers ──────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


async def _verify_password_async(plain: str, hashed: str) -> bool:
    """Run bcrypt verify in a thread pool so it doesn't block the event loop."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _verify_password, plain, hashed)


def _create_token(data: dict, expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expires_delta
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def _create_access_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id, "type": "access"},
        timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
    )


def _create_refresh_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id, "type": "refresh"},
        timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency: validate Bearer token and return the authenticated User."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise ValueError("wrong token type")
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("missing sub")
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await db.get(User, uuid.UUID(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


# ── Pydantic models ────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str | None
    preferred_language: str
    role: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut
    session_claimed: bool


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UpdateMeRequest(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    preferred_language: str | None = None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not await _verify_password_async(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")

    user.last_login_at = datetime.now(timezone.utc)

    # Claim the guest session: migrate guest data → user account
    session_id: uuid.UUID | None = getattr(request.state, "session_id", None)
    session_claimed = False
    if session_id:
        session_claimed = await claim_session(session_id, user.id, db)
    else:
        await db.commit()

    access_token = _create_access_token(str(user.id))
    refresh_token = _create_refresh_token(str(user.id))

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            preferred_language=user.preferred_language,
            role=user.role,
        ),
        session_claimed=session_claimed,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(body.refresh_token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise ValueError("wrong token type")
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("missing sub")
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = await db.get(User, uuid.UUID(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return TokenResponse(
        access_token=_create_access_token(str(user.id)),
        refresh_token=_create_refresh_token(str(user.id)),
    )


@router.post("/logout")
async def logout():
    # Stateless JWT — the client discards tokens.
    # The guest session cookie and its data are intentionally preserved.
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return UserOut(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        preferred_language=user.preferred_language,
        role=user.role,
    )


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UpdateMeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.phone is not None:
        user.phone = body.phone
    if body.preferred_language is not None:
        user.preferred_language = body.preferred_language

    return UserOut(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        preferred_language=user.preferred_language,
        role=user.role,
    )


@router.get("/sso/{provider}")
async def sso_placeholder(provider: str):
    return {"detail": "coming soon", "provider": provider}
